import { CloudFront } from "aws-sdk";
import { ALBHandler, ALBEvent, ALBResult } from "aws-lambda";
import { HLSMultiVariant, HLSMediaPlaylist } from "@eyevinn/hls-query";

const PUBLIC_KEY = process.env.PUBLIC_KEY;
let PRIVATE_KEY = process.env.PRIVATE_KEY;
const ORIGIN = process.env.ORIGIN || "https://lab-signed.cdn.eyevinn.technology";
const POC_USERNAME = process.env.POC_USERNAME || "eyevinnpoc";
const POC_PASSWORD = process.env.POC_PASSWORD || "eyevinnpoc";

if (process.env.PRIVATE_KEY_B64) {
  const buf = Buffer.from(process.env.PRIVATE_KEY_B64, "base64");
  PRIVATE_KEY = buf.toString("ascii");
}
const signer = new CloudFront.Signer(PUBLIC_KEY, PRIVATE_KEY);

enum IAuthenticated {
  yes,
  no,
};

const authenticate = async (username, password): Promise<IAuthenticated> => {
  if (username === POC_USERNAME && password === POC_PASSWORD) {
    return IAuthenticated.yes;
  }
}

export const getSignedManifestUrlFor = (manifestPath) => {
  const sign = signer.getSignedUrl({
    url: ORIGIN + manifestPath,
    expires: (new Date().getTime() + 3600 * 1000)
  });
  return new URL(sign);
};

const generateErrorResponse = ({ code: code, message: message }): ALBResult => {
  let response: ALBResult = {
    statusCode: code,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Origin",
    }
  };
  if (message) {
    response.body = JSON.stringify({ reason: message });
  }
  return response;
};

const generateUnauthResponse = (): ALBResult => {
  return {
    statusCode: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="Access to HLS streams"`,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Origin",
    }
  };
};

const signUrlSearchParams = (originPath, uri, expiresSec) => {
  const signedUrl = new URL(signer.getSignedUrl({
    url: originPath + "/" + uri,
    expires: (new Date().getTime() + expiresSec * 1000)
  }));
  return signedUrl.searchParams;
}

/*********************************************************************/

export const handler: ALBHandler = async (event: ALBEvent): Promise<ALBResult> => {
  console.log(event);
  let response;
  try {
    if (event.path.match(/\.m3u8$/) && Object.keys(event.queryStringParameters).length > 0 && event.httpMethod === "GET") {
      response = await handleMediaPlaylistRequest(event);
    } else if (event.path.match(/\.m3u8$/) && event.httpMethod === "GET") {
      response = await handleBasicAuthMultiVariantRequest(event);
    } else if (event.httpMethod === "OPTIONS") {
      response = await handleOptionsRequest(event);
    } else {
      response = generateErrorResponse({ code: 404, message: "Resource not found" });
    }
  } catch (error) {
    console.error(error);
    response = generateErrorResponse({ code: 500, message: error.message ? error.message : error });
  }
  return response;
};

const handleBasicAuthMultiVariantRequest = async (event: ALBEvent): Promise<ALBResult> => {
  if (event.headers["authorization"]) {
    const authHeader = event.headers["authorization"];
    const [ match, authScheme, authValue ] = authHeader.match(/^(.*)\s+(.*)$/);
    if (authScheme !== "Basic") {
      return generateErrorResponse({ code: 401, message: `Unsupported authentication method: ${authScheme}` });
    } else {
      const [ username, password ] = Buffer.from(authValue, "base64").toString().split(":");
      if ((await authenticate(username, password)) === IAuthenticated.yes) {
        return await handleMultiVariantRequest(event);
      }
    }
  } else {
    return generateUnauthResponse();
  }
};

const handleMultiVariantRequest = async (event: ALBEvent): Promise<ALBResult> => {
  const signedOriginUrl = getSignedManifestUrlFor(event.path);
  const [ match, signedOriginPath ] = signedOriginUrl.href.match(/^(.*)\/(.*?)$/);
  const hls = new HLSMultiVariant({ url: signedOriginUrl }, (uri) => signUrlSearchParams(signedOriginPath, uri, 3600));
  try {
    await hls.fetch();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/x-mpegURL",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Origin",
      },
      body: hls.toString()
    };
  } catch (error) {
    throw new Error(error + ": " + signedOriginUrl.href);
  }
};

const handleMediaPlaylistRequest = async (event: ALBEvent): Promise<ALBResult> => {
  const searchParams = new URLSearchParams(event.queryStringParameters);
  const [ match, signedOriginPath ] = event.path.match(/^(.*)\/(.*?)$/);
  const signedOriginUrl = new URL(ORIGIN + event.path + "?" + searchParams.toString());
  const hls = new HLSMediaPlaylist({ url: signedOriginUrl }, (uri) => signUrlSearchParams(ORIGIN + signedOriginPath, uri, 3600), new URL(ORIGIN + signedOriginPath + "/"));
  try {
    await hls.fetch();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/x-mpegURL",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Origin",
      },
      body: hls.toString()
    };
  } catch (error) {
    throw new Error(error + ": " + signedOriginUrl.href);
  }
};

const handleOptionsRequest = async (event: ALBEvent): Promise<ALBResult> => {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Origin',
      'Access-Control-Max-Age': '86400',
    }
  };
};