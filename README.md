# lambda-protect-hls

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Slack](http://slack.streamingtech.se/badge.svg)](http://slack.streamingtech.se)

Lambda function to handle access to HLS from a Cloudfront CDN distribution where signed URLs are required.

## How it works

Content distributed through a Cloudfront CDN that restricts viewer access requires a signature attached to each request as either a query parameter or a cookie provided on every client request. The way an HLS supported video player works is that it first fetches a manifest containing a list of media playlists. A media playlist contains the list of video segments that the video player downloads when playback is started. This Lambda function handles these requests and ensures that the URLs to media playlists and video segments includes a valid signature as query parameters. To sign the URLs the Lambda function needs the private key from the keypair that you have configured the Cloudfront CDN with.

A [blog post](https://dev.to/video/protect-hls-streams-on-aws-using-cloudfront-and-lambda-function-336g) detailing how this works is found [here](https://dev.to/video/protect-hls-streams-on-aws-using-cloudfront-and-lambda-function-336g).

## Setup

1. Create an AWS Lambda function (Node.js 14.x runtime)
2. Create a new role with basic Lambda permissions
3. Clone this repository, build and create a zip bundle

```
npm install
npm run build
cd dist
zip -qq -r ../bundle.zip ./
```

4. Deploy the `bundle.zip` to your created Lambda function.
5. Create and set the following environment variables:

```
PRIVATE_KEY_B64 = "<base64 encoded private_key (include BEGIN/END tags)>"
PUBLIC_KEY = "<id of the public key from the trusted key group that you have configured the Cloudfront CDN with>
```

6. Create and setup an Elastic Load Balancer that forwards requests to a Lambda target group configured to trigger the Lambda function you have created.

By default (and as a proof of concept) this Lambda uses Basic authentication to unlock access. It ask the browser for authentication when requesting the manifest. This is something you would normally modify to use a bearer / session token that is provided to the video player after veriyfing that the user is entitled to access this specific stream. You can set the username and password from the environment variables `POC_USERNAME` and `POC_PASSWORD`.

A live example of this Lambda in actions is found here: `https://hls-signed.lambda.eyevinn.technology/DEC6_TEST_002/master.m3u8` (`eyevinnpoc:eyevinnpoc`).

# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!