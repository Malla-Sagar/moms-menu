const cron = require('node-cron');
const { generateMeal, recordMeal, formatMealMessage } = require('./menuGenerator');
const { sendMessage } = require('./whatsapp');

let scheduledTask = null;
let todaysMeal = null;

function getTodaysMeal() {
  if (!todaysMeal || todaysMeal.date !== new Date().toISOString().split('T')[0]) {
    todaysMeal = generateMeal(new Date());
  }
  return todaysMeal;
}

function setTodaysMeal(meal) {
  todaysMeal = meal;
}

function startScheduler() {
  // Run every day at 8:00 AM IST (2:30 AM UTC)
  scheduledTask = cron.schedule('30 2 * * *', async () => {
    console.log('[Scheduler] Generating daily menu...');
    const meal = generateMeal(new Date());
    todaysMeal = meal;
    recordMeal(meal);
    const message = formatMealMessage(meal);
    await sendMessage(message);
    console.log('[Scheduler] Daily menu sent:', meal.dish.name);
  }, {
    timezone: 'Asia/Kolkata'
  });

  console.log('[Scheduler] Daily menu scheduled for 8:00 AM IST');
}

function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = { startScheduler, stopScheduler, getTodaysMeal, setTodaysMeal };
