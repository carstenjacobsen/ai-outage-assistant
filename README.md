# AI Outage Assistant
This project is a demo app built with Twilio ConversationRelay and OpenAI. Imagine an Internet provider called XYZ Internet has a support phone number where it's customers can call in to get outage information or get help to troubleshoot their home Internet.

### Voice Commands
This app has two different types of voice commands. The app has a very basic menu that will either let the caller get outage status (say "Status") or ask for help troubleshooting issues (say "Troubleshoot"). When the caller says "Troubleshoot" the user will be asked to describe the problem, which then is sent to OpenAI to get an answer.

Examples of voice commands:

* "Status" - this command will return the current status and report on any outages
* "Troubleshoot" - the assistant will reply with the question: _"Please describe your connection problem."_
  * "The router is blkinking orange"

**Example:** [sample_call.mp3](https://github.com/user-attachments/files/26223680/sample_call.mp3)
<audio controls>
  <source src="https://github.com/user-attachments/files/26223680/sample_call.mp3" type="audio/mpeg">
  ...
</audio>
[![Play demo](https://img.shields.io/badge/▶-Play%20Demo-blue)]([https://example.com/demo.mp3](https://github.com/user-attachments/files/26223680/sample_call.mp3))
_Note: The app doesn't actually retrieve an outage status, since this is just a demo with a made-up use case_

## Prerequisites
The app is based on Node.js and running the latest version is encouraged, since the app has not been tested with version earlier than v23. Get Node.js [here](https://nodejs.org). 

The app needs the following services:

* **Twilio Account** - sign up for a free trial [here](https://www.twilio.com/try-twilio)
* **Twilio Number (with Voice Capabilities)** - follow the guide [here](https://help.twilio.com/articles/223135247-How-to-Search-for-and-Buy-a-Twilio-Phone-Number-from-Console)
* **OpenAI Platform Account** - setup an account and get an API key [here](https://platform.openai.com/api-keys)

The app is not designed to be used in production, so for testing locally the Websocket is exposed to the Twilio services by using Localtunnel. This is a free, easy-to-use service.




## Explaining the Code
The app has four primary parts and the following is a high level explanation of each of them:

* `/twiml` endpoint
* `/ws` endpoint
* handlePrompt()
* aiResponse()

### `/twiml` endpoint
In the Twilio Phone Number service configuration, a webhook can be setup to be invoked when a phone call comes in. The webhook must be configured to invoke the `/twiml` endpoint of the app, and the endpoint is expected to return a response in the Twilio Markup Language. 

```node
import users from "./users.json" with { type: "json" };

const fastify = Fastify();
fastify.register(fastifyWs);
fastify.register(fastifyFormBody);
fastify.all("/twiml", async (request, reply) => {
  const caller = request.query.From || "unknown";
  const user = users.find((u) => u.phone === caller);
  const welcomeName = user ? user.firstname : "there!";
  const personalizedGreeting = `Hi ${welcomeName}! ${WELCOME_GREETING}`;

  reply.type("text/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <ConversationRelay url="${WS_URL}" welcomeGreeting="${personalizedGreeting}" />
      </Connect>
    </Response>`
  );
});
```

The response sets up ConversationRelay with the websocket URL `/ws` and the welcome greeting that callers will hear when the connection is made. 

The welcome greeting is personalized by looking up the caller in a JSON file. If the caller's phone number is known, the caller's firstname is used in the greeting. 

### `/ws` endpoint
The app is communicating with Twilio ConversationRelay through a websocket. When the caller speaks on the phone the speach is translated into text and sent to the app through the websocket (`prompt`). Text can also be sent from the app to ConversationRelay through the websocket, the text will be translated to speach and read out loud to the caller.

```node
fastify.register(async function (fastify) {
  fastify.get("/ws", { websocket: true }, (ws, req) => {
    ws.on("message", async (data) => {
      const message = JSON.parse(data);

      switch (message.type) {
        case "setup":
          const callSid = message.callSid;
          ws.callSid = callSid;
          sessions.set(callSid, { messages: [{ role: "system", content: SYSTEM_PROMPT }], mode: null });
          break;
        case "prompt":
          await handlePrompt(message.voicePrompt, ws, sessions.get(ws.callSid));
          break;
        case "interrupt":
          break;
        default:
          break;
      }
    });

    ws.on("close", () => {
      sessions.delete(ws.callSid);
    });
  });
});
```

The user's voice prompts are handled by the function `handlePrompt()`. Besides the prompt message type, the websocket logic also handles interruptions (the caller interrupts) and the initial setup of the websocket session. The session map `sessions` holds information about messages sent and received for each caller, so caller messages and information is not mixed up if there are multiple simultaneous active websocket sessions. 








### async function handlePrompt(prompt, ws, session)
The function `handlePrompt()` handles four different prompt cases. It handles the case where the user says "Status", the case where the user says "Troubleshoot", the case where user said "Troubleshoot" in the previous prompt, and now explains what the issue is, and finally `handlePrompt()` handles undefined cases (catch-all).

```node
async function handlePrompt(prompt, ws, session) {
  const normalized = prompt.toLowerCase().replace(/[^a-z]/g, "");

  if (normalized === "status") {
    const response = "No outages are currently detected. Say 'Troubleshoot' if you are experiencing connection issues and would like help diagnosing the problem.";
    ws.send(JSON.stringify({ type: "text", token: response, last: true }));
    return;
  }

  if (normalized === "troubleshoot") {
    session.mode = "troubleshoot";
    const response = "Please describe your connection problem.";
    ws.send(JSON.stringify({ type: "text", token: response, last: true }));
    return;
  }

  if (session.mode === "troubleshoot") {
    session.mode = null;
    const messages = [
      { role: "system", content: SYSTEM_PROMPT + " " + TROUBLESHOOT_PROMPT },
      { role: "user", content: prompt },
    ];
    const response = await aiResponse(messages);
    ws.send(JSON.stringify({ type: "text", token: response, last: true }));
    return;
  }

  session.messages.push({ role: "user", content: prompt });
  const response = await aiResponse(session.messages);
  session.messages.push({ role: "assistant", content: response });
  ws.send(JSON.stringify({ type: "text", token: response, last: true }));
}
```

### async function aiResponse(messages)
The function `handlePrompt()` sends user prompts to OpenAI for troubleshooting advice based on the user's input. All communication with OpenAI is handled by the OpenAI SDK, and requires very little configuration.  

```node
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function aiResponse(messages) {
  let completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
  });
  return completion.choices[0].message.content;
}
```

## Run the App

### Install Dependencies
First clone this repository, and then install all dependencies:

```bash
npm install
```

### Setup Localtunnel
Localtunnel allows you to easily share a web service on your local development machine without having to think about DNS and firewall settings. Localtunnel will assign you a unique publicly accessible url that will proxy all requests to your locally running webserver.

Install Localtunnel globally to make it accessible anywhere:

```bash
npm install -g localtunnel
```

Request a tunnel to your local server (the app will run on port 8080) and give it a name:

```bash
lt --port 8080 --subdomain statusassist 
```

_Note: Be aware that Localtunnel is a free service and may not be stable. This is not a solution for production._

### Modify Environment
The app needs information about OpenAI, the public Localtunnel URL and the port number the app is running on locally:

```bash
OPENAI_API_KEY="sk-proj-xxxxxxxxxxxxxx"
DOMAIN="statusassist.loca.lt"
PORT=8080
```

### Start App
That's it! Now just start the app:

```bash
node server.js
```







