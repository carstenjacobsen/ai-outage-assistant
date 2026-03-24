import Fastify from "fastify";
import fastifyWs from "@fastify/websocket";
import fastifyFormBody from "@fastify/formbody";
import OpenAI from "openai";
import dotenv from "dotenv";

import users from "./users.json" with { type: "json" };

dotenv.config();

const PORT = process.env.PORT || 8080;
const DOMAIN = process.env.DOMAIN;
const WS_URL = `wss://${DOMAIN}/ws`;
const WELCOME_GREETING =
  "I am X Y Z Internet's Status voice assistant. Say 'Status' for current outage information, or 'Troubleshoot' for help with your connection.";
const SYSTEM_PROMPT =
  "You are a helpful assistant. This conversation is being translated to voice, so answer carefully. When you respond, please spell out all numbers, for example twenty not 20. Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols.";
const TROUBLESHOOT_PROMPT =
  "The user is experiencing an internet connection issue. Based on their description, suggest two or three possible fixes in simple, clear language. Do not use bullet points, numbers, asterisks, or special characters.";
const sessions = new Map();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function aiResponse(messages) {
  let completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
  });
  return completion.choices[0].message.content;
}

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
}

const fastify = Fastify();
fastify.register(fastifyWs);
fastify.register(fastifyFormBody);
fastify.all("/twiml", async (request, reply) => {
  const caller = request.query.From || "unknown";
  console.log("Caller phone number:", caller);
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

fastify.register(async function (fastify) {
  fastify.get("/ws", { websocket: true }, (ws, req) => {
    ws.on("message", async (data) => {
      const message = JSON.parse(data);

      switch (message.type) {
        case "setup":
          const callSid = message.callSid;
          console.log("Setup for call:", callSid);
          ws.callSid = callSid;
          sessions.set(callSid, { messages: [{ role: "system", content: SYSTEM_PROMPT }], mode: null });
          break;
        case "prompt":
          console.log("Processing prompt:", message.voicePrompt);
          await handlePrompt(message.voicePrompt, ws, sessions.get(ws.callSid));
          break;
        case "interrupt":
          console.log("Handling interruption.");
          break;
        default:
          console.warn("Unknown message type received:", message.type);
          break;
      }
    });

    ws.on("close", () => {
      console.log("WebSocket connection closed");
      sessions.delete(ws.callSid);
    });
  });
});

try {
  fastify.listen({ port: PORT });
  console.log(
    `Server running at http://localhost:${PORT} and wss://${DOMAIN}/ws`
  );
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
