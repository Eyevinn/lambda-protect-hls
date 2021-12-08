import { handler } from "./index";
import { ALBHandler, ALBEvent, ALBResult } from "aws-lambda";

describe("multivariant playlist request", () => {
  test("adding signed URLs for each stream URL", async () => {
    /*
    const event: ALBEvent = {
      path: "/TEST_001/master.m3u8",
      httpMethod: "GET",
      requestContext: undefined,
      body: "",
      isBase64Encoded: false
    };
    const response = await handler(event, null, null);
    console.log(response);
    */
  });
})