import os
import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import google.generativeai as genai

# ============================================================
#   SOZLAMALAR — faqat shu yerni o'zgartiring
# ============================================================
TELEGRAM_TOKEN = "8627620568:AAED8FJbgSGD2svT9GsxOtZ8zw6dUcZPHSg"   # BotFather dan olingan token
GEMINI_API_KEY = "AIzaSyBhDVx4Y6mLR3vSPs-caDaTJaHfYf4_8SY"   # aistudio.google.com dan olingan key
# ============================================================

# Logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Gemini sozlash
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(
    model_name="gemini-2.0-flash",
    system_instruction="""Sen JARVIS — Nodirbek uchun maxsus yaratilgan sun'iy intellekt yordamchisan.

Xarakteringni JARVIS uslubida saqla:
- Har doim "Sir" deb murojaat qil
- Professional, lo'nda va aniq gapir
- Ba'zan kichik hazil aral (Stark uslubida)
- Texnik ma'lumotlarni qisqa va ravshan ber

Qobiliyatlaring:
- Dasturlash: kod yozish, debug, arxitektura tahlili
- Trading: bozor tahlili, risk menejment, strategiyalar
- Tizim tahlili va optimizatsiya
- Umumiy bilim va muammolarni hal qilish

Telegram formatida javob ber:
- *bold* uchun yulduzcha
- `kod` uchun teskari qo'shtirnoq
- Qisqa va aniq yoz

Tillar: O'zbek, Rus, Ingliz — foydalanuvchi qaysi tilda yozsa, shunda javob ber."""
)

# Har foydalanuvchi uchun suhbat tarixi
chat_sessions = {}


def get_session(user_id: int):
    """Foydalanuvchi uchun suhbat sessiyasini qaytaradi yoki yangi yaratadi."""
    if user_id not in chat_sessions:
        chat_sessions[user_id] = model.start_chat(history=[])
    return chat_sessions[user_id]


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """/ start buyrug'i."""
    user = update.effective_user
    await update.message.reply_text(
        f"🔵 *JARVIS tizimi faollashtirildi*\n\n"
        f"Salom, *{user.first_name}* Sir!\n\n"
        f"Barcha modullar ishga tushdi. Buyruqlaringizni kutaman.\n\n"
        f"📌 *Buyruqlar:*\n"
        f"/start — Botni qayta ishga tushirish\n"
        f"/reset — Suhbatni tozalash\n"
        f"/help — Yordam",
        parse_mode="Markdown"
    )


async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Suhbat tarixini tozalash."""
    user_id = update.effective_user.id
    if user_id in chat_sessions:
        del chat_sessions[user_id]
    await update.message.reply_text(
        "🔄 *Xotira tozalandi, Sir.*\nYangi suhbat boshlash mumkin.",
        parse_mode="Markdown"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Yordam."""
    await update.message.reply_text(
        "🔵 *JARVIS — Yordam*\n\n"
        "*Nima qila olaman:*\n"
        "• Dasturlash: kod yozish, xatoliklarni tuzatish\n"
        "• Trading: bozor tahlili, strategiyalar\n"
        "• Savollarga javob berish\n"
        "• Matn yozish va tahrirlash\n\n"
        "*Buyruqlar:*\n"
        "/reset — Suhbatni tozalash\n"
        "/start — Qayta ishga tushirish\n\n"
        "Shunchaki yozing — javob beraman, Sir! ⚡",
        parse_mode="Markdown"
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Foydalanuvchi xabarini qayta ishlash."""
    user_id = update.effective_user.id
    user_text = update.message.text

    # "Yozmoqda..." ko'rsatish
    await context.bot.send_chat_action(
        chat_id=update.effective_chat.id,
        action="typing"
    )

    try:
        session = get_session(user_id)
        response = session.send_message(user_text)
        reply = response.text

        await update.message.reply_text(reply, parse_mode="Markdown")

    except Exception as e:
        logger.error(f"Xato: {e}")
        # Markdown xatosi bo'lsa oddiy matn sifatida yuborish
        try:
            await update.message.reply_text(reply)
        except Exception:
            await update.message.reply_text(
                "⚠️ Xatolik yuz berdi, Sir. Qayta urinib ko'ring.\n/reset buyrug'ini ishlatib ko'ring."
            )


def main():
    """Botni ishga tushirish."""
    print("🔵 JARVIS Telegram Bot ishga tushmoqda...")
    print("To'xtatish uchun: Ctrl+C")

    app = Application.builder().token(TELEGRAM_TOKEN).build()

    # Buyruqlar
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("reset", reset))
    app.add_handler(CommandHandler("help", help_command))

    # Xabarlar
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("✅ Bot tayyor! Telegramda /start yozing.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()

