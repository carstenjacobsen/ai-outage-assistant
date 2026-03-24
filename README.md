# AI Outage Assistant
This project is a demo app built with Twilio ConversationRelay and OpenAI. Imagine an Internet provider called XYZ Internet has a support phone number where it's customers can call in to get outage information or get help to troubleshoot their home Internet.

### Voice Commands
This app has two different types of voice commands. The app has a very basic menu that will either let the caller get outage status (say "Status") or ask for help troubleshooting issues (say "Troubleshoot"). When the caller says "Troubleshoot" the user will be asked to describe the problem, which then is sent to OpenAI to get an answer.

Examples of voice commands:

* "Status" - this command will return the current status and report on any outages
* "Troubleshoot" - the assistant will reply with the question: _"Please describe your connection problem."_
  * "The router is blkinking orange"

_Note: The app doesn't actually retrieve an outage status, since this is just a demo with a made-up use case_

## Prerequisites
The app is based on Node.js and running the latest version is encouraged, since the app has not been tested with version earlier than v23. Get Node.js [here](https://nodejs.org). 

The app needs the following services:

* **Twilio Account** - sign up for a free trial [here](https://www.twilio.com/try-twilio)
* **Twilio Number (with Voice Capabilities)** - follow the guide [here](https://help.twilio.com/articles/223135247-How-to-Search-for-and-Buy-a-Twilio-Phone-Number-from-Console)
* **OpenAI Platform Account** - setup an account and get an API key [here](https://platform.openai.com/api-keys)

The app is not designed to be used in production, so for testing locally the Websocket is exposed to the Twilio services by using Localtunnel. This is a free, easy-to-use service.




## Explaining the Code
The app has four primary parts and the following is a high level explanation of those four:

* `/twiml` endpoint
* `/ws` endpoint
* handlePrompt()
* aiResponse()
* 

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





### async function aiResponse(messages)


```node
import OpenAI from "openai";

async function aiResponse(messages) {
  let completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
  });
  return completion.choices[0].message.content;
}
```








### async function handlePrompt(prompt, ws, session)
The function `handlePrompt()` handles four different prompt cases. It handles the case where the user says "Status", the case where the user says "Troubleshoot", the case where user said "Troubleshoot" in the previous prompt, and now explains what the issue is, and finally `handlePrompt()` handles undefined cases.

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


###



## Run the App

* npm install
* .env
* localtunnel
* run node script


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






