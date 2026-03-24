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

The app is not designed to be used in production, so for testing locally the Websocket is exposed to the Twilio services by using LocalTunnel. This is a free, easy-to-use bridge. Installation and configuration is described below.




### handlePrompt(prompt, ws, session)
sdfasfasfds

```node
async function handlePrompt(prompt, ws, session) {
  const normalized = prompt.toLowerCase().replace(/[^a-z]/g, "");

  if (normalized === "status") {
    const response = "No outages are currently detected. Say 'Troubleshoot' if you are experiencing connection issues and would like help diagnosing the problem.";
    ws.send(JSON.stringify({ type: "text", token: response, last: true }));
    console.log("Sent status response:", response);
    return;
  }

  if (normalized === "troubleshoot") {
    session.mode = "troubleshoot";
    const response = "Please describe your connection problem.";
    ws.send(JSON.stringify({ type: "text", token: response, last: true }));
    console.log("Prompted user for troubleshoot description.");
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
    console.log("Sent troubleshoot AI response:", response);
    return;
  }

  session.messages.push({ role: "user", content: prompt });
  const response = await aiResponse(session.messages);
  session.messages.push({ role: "assistant", content: response });
  ws.send(JSON.stringify({ type: "text", token: response, last: true }));
  console.log("Sent response:", response);
  console.log("Current sessions:", session);
}
```






## Run the App

* npm install
* .env
* localtunnel
* run node script


