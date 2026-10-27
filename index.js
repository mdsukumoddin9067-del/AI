const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalFollow = goals.GoalFollow;
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
const ai = new GoogleGenAI();

const botOptions = {
    host: settings.minecraft.host,
    port: settings.minecraft.port,
    username: settings.minecraft.username,
    version: settings.minecraft.version,
    auth: 'offline'
};

let bot = null;

function startBot() {
    console.log(`[Connecting] Attempting to connect to ${botOptions.host}:${botOptions.port} as ${botOptions.username}...`);
    
    bot = mineflayer.createBot(botOptions);
    bot.loadPlugin(pathfinder);

    bot.on('spawn', () => {
        console.log(`[Game Success] ${bot.username} has successfully spawned in the world! 🎉`);
        
        const defaultMove = new Movements(bot);
        bot.pathfinder.setMovements(defaultMove);

        // Anti-AFK: সার্ভার থেকে আইডল কিক এড়াতে প্রতি ৩০ সেকেন্ড পর পর নড়বে
        setInterval(() => {
            if (bot && bot.entity) {
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 500);
                bot.look(bot.entity.yaw + 0.5, bot.entity.pitch, true);
            }
        }, 30000);
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;

        const cmd = message.toLowerCase().trim();
        const playerEntity = bot.players[username]?.entity;

        if (cmd.includes('follow') || cmd.includes('আসো')) {
            if (!playerEntity) {
                bot.chat(`আমি দেখতে পাচ্ছি না ${username}!`);
                return;
            }
            bot.chat(`আসছি ${username}!`);
            bot.pathfinder.setGoal(new GoalFollow(playerEntity, 2), true);
            return;
        }

        if (cmd.includes('stop') || cmd.includes('থামো')) {
            bot.chat('দাঁড়িয়ে গেলাম।');
            bot.pathfinder.setGoal(null);
            return;
        }

        try {
            console.log(`[AI Prompt from ${username}]: ${message}`);
            
            const response = await ai.models.generateContent({
                model: settings.ai.model,
                contents: [
                    {
                        role: 'user',
                        parts: [{
                            text: `You are an AI player companion inside Minecraft named ${bot.username}. A player named ${username} said to you: "${message}". Reply naturally, friendly, and briefly in Bengali or English (matching the user's language) as a helpful Minecraft friend. Keep the response under 15 words so it fits well in game chat.`
                        }]
                    }
                ]
            });

            const replyText = response.text ? response.text.trim() : "আমি বুঝতে পারিনি!";
            bot.chat(replyText);
            console.log(`[AI Reply]: ${replyText}`);

        } catch (error) {
            console.error('[Gemini AI Error]:', error);
            bot.chat('আমার ব্রেন একটু কাজ করছে না বন্ধু!');
        }
    });

    bot.on('kicked', (reason) => {
        console.log(`[Kicked by Server]:`, reason);
    });

    bot.on('error', (err) => {
        console.error('[Bot Error]:', err.message);
    });
    
    bot.on('end', (reason) => {
        console.log(`[Disconnected]: ${reason}. Reconnecting in 10s...`);
        setTimeout(() => {
            startBot();
        }, 10000);
    });
}

startBot();
