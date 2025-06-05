const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require('dotenv').config();
const prompts = require("./assets/prompts.js");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const MAIN_MENU = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🌿 Онлайн Психолог", callback_data: "psycholog" }
      ],
      [
        { text: "🍏 Онлайн Диетолог", callback_data: "dietolog" }
      ],
      [
        { text: "⭐️ Онлайн Астролог", callback_data: "astrolog" }
      ],
    ]
  },
  parse_mode: "HTML"
};

const BALANCE_MENU = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "⭐️ Подписка на 1 неделю - 490 руб.", callback_data: "balance_topup" }
      ],
      [
        { text: "🥲 Отменить подписку", callback_data: "balance_cancel" }
      ],
    ]
  },
  parse_mode: "HTML"
};

const BALANCE_OPTIONS_MENU = {
  reply_markup: {
    inline_keyboard: [
    //   [
    //     { text: "СБП", callback_data: "topup_sbp" }
    //   ],
      [
        { text: "Картой", callback_data: "topup_card" }
      ],
      [
        { text: "Telegram Stars", callback_data: "topup_stars" }
      ],
    ]
  },
  parse_mode: "HTML"
};

const userContext = {};
const userHistory = {};

bot.setMyCommands([
    { command: "new", description: "На главную" },
    { command: "balance", description: "Подписка / Отменить подписку" },
    { command: "contact", description: "Связаться с нами" },
    { command: "terms", description: "Публичная оферта" },
    { command: "policy", description: "Политика конфиденциальности" },
]);

const welcomeMessage = `
Добро пожаловать в Women's World!

Здесь ты получишь поддержку и ответы на самые важные вопросы о себе — честно, без осуждения и лишней воды.

Выбери, что для тебя сейчас актуальнее:

🌿 <b>Онлайн Психолог</b> — поговорим о тебе, чувствах, границах, отношениях и самоценности.

⭐ <b>Онлайн Астрология</b> — хорарная астрология (астрология вопроса) — только конкретика и по делу.

🥗 <b>Онлайн Диетолог</b> — выстроишь питание под свою цель: похудение, энергию или здоровье.

💥 <b>Дневник Агрессии</b> — выговорись и пойми, что за этим стоит.

Выбери интересующий тебя раздел и нажми на кнопку ниже 👇
`;

const subscribeText = `
Чтобы специалист начал работать с тобой — оформи мини-подписку.

Всего 490 ₽ в неделю. 
Отменить можно в любой момент, в один клик.

🌸 Ты получишь:

• Доступ ко всем разделам: психология, астрология, диетология, дневник агрессии  
• Людей, которые работают лично под твой запрос  
• Честные и конкретные ответы — именно на твои вопросы  
• Поддержку с вниманием к твоей ситуации, без шаблонов  

⭐️ Никаких скрытых списаний — всё прозрачно и по-честному.
`;

bot.onText(/\/start|\/new/, async (msg) => {
  const chatId = msg.chat.id;

  // 🔄 Register user in the backend
  try {
    await axios.post("https://numerologyfromkate.com/api/users/register", {
      account_id: String(chatId)
    });
  } catch (err) {
    console.error("❌ Failed to register user:", err?.response?.data || err.message);
  }

  await bot.sendPhoto(chatId, "./0.jpg", {
    caption: welcomeMessage,
    parse_mode: "HTML",
    ...MAIN_MENU
  });
});

bot.onText(/\/contact/, (msg) => {
  bot.sendMessage(msg.chat.id, "@KateFromJuly");
});


bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;
  const balanceMessage = `
<b>✨ Доступ к сервису Women's World — за 3 шага:</b>

1️⃣ Выбери нужный тариф ниже
2️⃣ Оплати любым удобным способом 
3️⃣ Получи доступ и начинай пользоваться — всё открывается сразу после оплаты

Стоимость сервиса — 490 руб / нед.

🌸 <b>Используй каждый день — и ты получишь:</b>
 • персонального психолога, астролога, диетолога и многое другое  
 • поддержку 24/7  
 • помощь в любых жизненных ситуациях  
`;

  bot.sendMessage(chatId, balanceMessage, BALANCE_MENU);
});

bot.onText(/\/terms/, (msg) => {
  bot.sendMessage(msg.chat.id, "https://ekaterinasukhoroslova.tilda.ws/oferta");
});

bot.onText(/\/policy/, (msg) => {
  bot.sendMessage(msg.chat.id, "https://ekaterinasukhoroslova.tilda.ws/politica");
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "astrolog") {
    userContext[chatId] = "Астролог";
    userHistory[chatId] = [];
    await bot.sendPhoto(chatId, "./2.png", {
      caption: `
<b>⭐️ ХОРАРНАЯ АСТРОЛОГИЯ</b>

Метод, который даёт точный ответ на конкретный вопрос.
Важно не твоя натальная карта, а дата, время и город, где ты находишься в момент вопроса.
Астролог строит карту на этот момент и даёт чёткий прогноз.
Дата и место рождения не нужны - работает момент запроса.

Примеры вопросов:
- Позовут ли меня на работу?
- Любит ли он меня?
- Купит ли клиент мой продукт?
- Стоит ли принимать это предложение?

📩 Чтобы получить ответ, напиши:
Точную дату, время и город, где ты задала вопрос.
Подробный контекст.

<b>Примеры:</b>
🗓 25.05.2025, 14:30, Москва
Сейчас ищу работу на HH. Компания — Жили Были. Прошла 2 собеса, впереди ещё 1. Вопрос: пригласят ли меня и когда выйду на работу?

🗓 31.05.2025, 13:50, Москва
Где мой муж? С кем? Во сколько будет дома? Помиримся ли? Кто первый пойдёт на примирение? Он сказал, что отец прилетает на 4 часа в Москву и планирует с ним встретиться, но сам пропал.
`,
    parse_mode: "HTML"
    });
  }

  if (data === "psycholog") {
    userContext[chatId] = "Психолог";
    userHistory[chatId] = [];
    await bot.sendPhoto(chatId, "./1.jpg", {
      caption: `
<b>🧠 ОНЛАЙН ПСИХОЛОГ</b>

Добро пожаловать в безопасное пространство, где ты можешь один на один проговорить свои переживания, разобраться в себе и найти ответы на волнующие вопросы.
Без осуждения, давления и навязанных советов.

Консультация с психологом подойдет вам, если:

- тяжело на душе, и не с кем поговорить
- есть проблемы в отношениях
- чувствуешь тревогу, апатию или неуверенность
- хочешь понять, чего хочешь и как себе помочь

Всё проходит через онлайн-чат — удобно, конфиденциально и в твоём ритме.

<b>📩 Чтобы начать чат с психологом: представьтесь и напишите свой вопрос ниже</b>

<b>Пример:</b>

Меня зовут Екатерина
Не могу уйти от бывшего. Что делать?
`,
      parse_mode: "HTML"
    });
  }

  if (data === "dietolog") {
    userContext[chatId] = "Диетолог";
    userHistory[chatId] = [];
    await bot.sendPhoto(chatId, "./3.jpg", {
      caption: `
<b>🥗 ОНЛАЙН ДИЕТОЛОГ</b>

Поддержка в вопросах питания и веса - без стресса, давления и жёстких запретов.

Здесь ты получишь персональные рекомендации по питанию — с учётом твоих целей, привычек и образа жизни.

<b>Подойдёт, если:</b>
- хочешь похудеть, но не знаешь, с чего начать
- хочешь наладить питание без диет и срывов
- переедаешь или «заедаешь» стресс
- хочешь больше энергии и лёгкости в теле
- нужен понятный план питания под твой ритм жизни

Всё проходит через онлайн-чат — быстро, конфиденциально и без осуждения.
Рацион подбирается индивидуально: по твоим вкусам, целям и возможностям.

<b>📩 Чтобы получить рацион питания:</b>
Напиши ниже, к какому весу хочешь прийти и каких целей достичь.

<b>Пример:</b>
Меня зовут Екатерина, вешу 62 кг, хочу похудеть до 55 кг. Люблю курицу и мясо, не ем цветную капусту и оливки.
`,
      parse_mode: "HTML"
    });
  }

  if (data === "balance_topup") {
    await bot.sendMessage(chatId, "🌸 Выбери для себя удобный способ оплаты:", BALANCE_OPTIONS_MENU);
  }

    if (data === "topup_card") {
        try {
            const { data } = await axios.post("https://numerologyfromkate.com/api/payment/init", {
            account_id: String(chatId)
            });

            await bot.sendMessage(chatId, "🔗 Для оплаты перейдите по ссылке:", {
            reply_markup: {
                inline_keyboard: [[{ text: "💳 Оплатить", url: data.url }]]
            }
            });
        } catch (err) {
            const errorText = err?.response?.data?.error;
            if (errorText === "Subscription already active") {
            await bot.sendMessage(chatId, "🎉 У вас уже активна подписка! Спасибо 🙏");
            } else {
            console.error("❌ Failed to generate payment link:", err?.response?.data || err.message);
            await bot.sendMessage(chatId, "⚠️ Не удалось создать ссылку на оплату. Попробуйте позже.");
            }
        }
    }

    // if (data === "topup_sbp") {
    //     try {
    //         const { data } = await axios.post("https://numerologyfromkate.com/api/payment/sbp", {
    //         account_id: String(chatId)
    //         });

    //         await bot.sendMessage(chatId, "🔗 Оплата через СБП:", {
    //         reply_markup: {
    //             inline_keyboard: [
    //             [{ text: "🚀 Оплатить через СБП", url: data.url }]
    //             ]
    //         }
    //         });
    //     } catch (err) {
    //         console.error("❌ SBP link error:", err?.response?.data || err.message);
    //         await bot.sendMessage(chatId, "⚠️ Не удалось создать ссылку на оплату. Попробуйте позже.");
    //     }
    // }

    if (data === "balance_cancel") {
        try {
            const response = await axios.post("https://numerologyfromkate.com/api/subscription/cancel", {
            account_id: String(chatId)
            });

            await bot.sendMessage(chatId, "Подписка успешно отменена. Вы всегда можете вернуться позже ❤️");
        } catch (err) {
            const msg = err?.response?.data?.error || err.message;

            if (msg === "No active subscription to cancel") {
            await bot.sendMessage(chatId, "📭 У вас нет активной подписки.");
            } else if (msg === "Subscription payment not recurrent") {
            await bot.sendMessage(chatId, "🧾 Ваша подписка куплена при помощи одноразового платежа, дальнейших списаний не будет. Спасибо 🙏");
            }
            else {
            console.error("❌ Cancel error:", msg);
            await bot.sendMessage(chatId, "⚠️ Не удалось отменить подписку. Попробуйте позже.");
            }
        }
    }

    if (data === "topup_stars") {

        try {
            const { data: status } = await axios.post("https://numerologyfromkate.com/api/subscription/check", {
            account_id: String(chatId)
            });

            if (status.allowed) {
            await bot.sendMessage(chatId, "🎉 У вас уже активна подписка! Спасибо 🙏");
            return;
            }
        } catch (err) {
            console.error("❌ Stars check error:", err?.response?.data || err.message);
            await bot.sendMessage(chatId, "⚠️ Не удалось проверить подписку. Попробуйте позже.");
            return;
        }
        
        const priceInStars = 200;                 // 490 Stars for 1 week
        const payload      = `stars_${chatId}_${Date.now()}`;   // anything you want

        await bot.sendInvoice(
            chatId,
            "Women’s World ✨ подписка 7 дней",
            "⚡ Все эксперты сразу: психолог, астролог, диетолог.",
            payload,
            "",                           // provider_token — empty for Stars
            "XTR",                        // currency
            [ { label: "\u00A0", amount: priceInStars } ],
            {
                // optional deep-link parameter → Pay-button caption
                reply_markup: {
                inline_keyboard: [
                    [{ text: "💫 Оплатить 200 Stars", pay: true }]
                ]
                }
            }
            );
  }

  bot.answerCallbackQuery(query.id); // remove loading spinner on button press
});

bot.on("pre_checkout_query", async (query) => {
  try {
    const chatId = query.from.id;

    const { data: status } = await axios.post("https://numerologyfromkate.com/api/subscription/check", {
      account_id: String(chatId)
    });

    if (status.allowed) {
      // ❌ Already subscribed — reject payment
      await bot.answerPreCheckoutQuery(query.id, false, {
        error_message: "🎉 У вас уже активна подписка! Спасибо 🙏"
      });
      return;
    }

    // ✅ Allow payment
    await bot.answerPreCheckoutQuery(query.id, true);
  } catch (err) {
    console.error("❌ Error in pre_checkout_query:", err?.response?.data || err.message);
    await bot.answerPreCheckoutQuery(query.id, false, {
      error_message: "⚠️ Не удалось проверить подписку. Попробуйте позже."
    });
  }
});

async function askOpenAI(role, messages) {

  const contextMessages = messages.slice(-20).map((m, i) => ({
    role: i % 2 === 0 ? "user" : "assistant",
    content: m
  }));

  try {
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4o",
      messages: [{ role: "system", content: prompts[role] }]
        .concat(contextMessages)
        .concat({ role: "user", content: messages[messages.length - 1] }),
      temperature: 0.7
    }, {
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI error:", error?.response?.data || error);
    return "⚠️ Произошла ошибка при обращении к помощнику. Попробуйте позже.";
  }
}

bot.on("message", async (msg) => {

    if (msg.successful_payment) {
        const chatId  = msg.chat.id;
        const amount  = msg.successful_payment.total_amount;
        const payload = msg.successful_payment.invoice_payload;
        const starsTx = msg.successful_payment.telegram_payment_charge_id;

        console.log(`💰 Stars payment ${amount} XTR, tx: ${starsTx}`);

        // Tell your backend to activate the subscription
        try {
        await axios.post("https://numerologyfromkate.com/api/payment/stars-success", {
            account_id: String(chatId),
            amount,
            tx_id:   starsTx,
            payload
        });
        } catch (e) {
        console.error("Could not notify backend:", e.message);
        }

        await bot.sendMessage(chatId,
        "🎉 Оплата получена! Доступ на неделю активирован.\n" +
        "Задавай свой вопрос – мы готовы помочь.");
        return;                    // don’t fall through to normal text handler
    }

  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // Ignore commands and button clicks
  if (!text || msg.data || text.startsWith("/")) return;

  const role = userContext[chatId];
  if (!role) {
    return bot.sendMessage(chatId, "Пожалуйста, выберите раздел из меню.", MAIN_MENU);
  }

  // Add message to user history
  userHistory[chatId] = userHistory[chatId] || [];
  userHistory[chatId].push(text);

  try {
  const { data } = await axios.post("https://numerologyfromkate.com/api/subscription/check", {
    account_id: String(chatId)
  });

  if (!data.allowed) {
    await bot.sendMessage(chatId, subscribeText, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
            [
                { text: "💳 Оплатить", callback_data: "balance_topup" }
            ]
            ]
        }
        });
        return;
  }
} catch (err) {
  console.error("❌ Subscription check error:", err?.response?.data || err.message);
  return bot.sendMessage(chatId, "⚠️ Ошибка при проверке подписки. Попробуйте позже.");
}

  const reply = await askOpenAI(role, userHistory[chatId]);
  userHistory[chatId].push(reply);

  return bot.sendMessage(chatId, reply, { parse_mode: "HTML" });
});