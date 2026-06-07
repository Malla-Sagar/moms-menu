const twilio = require('twilio');

let client = null;

function getClient() {
  if (!client && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return client;
}

async function sendMessage(body) {
  const twilioClient = getClient();
  if (!twilioClient) {
    console.log('[WhatsApp - DRY RUN] Would send:', body);
    return { success: true, dryRun: true };
  }

  try {
    const message = await twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: process.env.WHATSAPP_TO,
      body
    });
    console.log(`[WhatsApp] Sent message SID: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error('[WhatsApp] Error sending:', err.message);
    return { success: false, error: err.message };
  }
}

function parseIncomingMessage(body) {
  const lower = body.toLowerCase().trim();

  if (lower === 'another' || lower === 'change' || lower === 'different') {
    return { command: 'alternative', noVeggies: false };
  }
  if (lower === 'no veggies' || lower === 'no veggie' || lower === 'without veggies') {
    return { command: 'alternative', noVeggies: true };
  }
  if (lower === 'next week' || lower === 'weekly' || lower === 'week plan') {
    return { command: 'weeklyPlan' };
  }
  if (lower === 'today' || lower === 'menu' || lower === 'what today') {
    return { command: 'todayMenu' };
  }
  if (lower.startsWith('add dish')) {
    return { command: 'addDish', details: body.substring(8).trim() };
  }
  if (lower.startsWith('remove dish')) {
    return { command: 'removeDish', details: body.substring(11).trim() };
  }
  if (lower === 'help' || lower === 'commands') {
    return { command: 'help' };
  }

  return { command: 'unknown' };
}

function getHelpMessage() {
  return `*Mom's Menu - Commands*\n\n` +
    `• *today* - Get today's menu\n` +
    `• *another* - Get a different dish suggestion\n` +
    `• *no veggies* - Get a dish that doesn't need veggies\n` +
    `• *next week* - Get next week's meal plan\n` +
    `• *add dish [name]* - Add a new dish\n` +
    `• *remove dish [name]* - Remove a dish\n` +
    `• *help* - Show this message`;
}

module.exports = { sendMessage, parseIncomingMessage, getHelpMessage };
