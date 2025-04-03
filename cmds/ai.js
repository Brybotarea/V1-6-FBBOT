const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
    name: "copilot",
    usePrefix: false,
    usage: "copilot <prompt> | <reply to an image>",
    version: "1.5",

    execute: async ({ api, event, args }) => {
        try {
            const { messageID, threadID } = event;
            let prompt = args.join(" ");
            let imageUrl = null;
            let apiUrl = `https://api.zetsu.xyz/api/copilot?prompt=${encodeURIComponent(prompt)}`;

            if (event.messageReply && event.messageReply.attachments.length > 0) {
                const attachment = event.messageReply.attachments[0];
                if (attachment.type === "photo") {
                    imageUrl = attachment.url;
                    apiUrl += `&imagurl=${encodeURIComponent(imageUrl)}`;
                }
            }

            const loadingMsg = await api.sendMessage("🔎 Processing your request, please wait...", threadID);
            
            const response = await axios.get(apiUrl);
            if (!response.data) {
                return api.sendMessage("⚠️ No response received. Try again.", threadID, loadingMsg.messageID);
            }

            const { description, image } = response.data;

            if (image) {
                const imagePath = path.join(__dirname, "gemini_image.jpg");
                const writer = fs.createWriteStream(imagePath);
                const imageResponse = await axios({
                    url: image,
                    method: "GET",
                    responseType: "stream",
                });

                imageResponse.data.pipe(writer);
                writer.on("finish", () => {
                    api.sendMessage(
                        {
                            body: `🖼️ **Image Generated:**\n${prompt}`,
                            attachment: fs.createReadStream(imagePath),
                        },
                        threadID,
                        () => fs.unlinkSync(imagePath),
                        loadingMsg.messageID
                    );
                });
                return;
            }

            if (description) {
                return api.sendMessage(`🤖 **GEMINI AI**\n━━━━━━━━━━━━━━━━\n${description}\n━━━━━━━━━━━━━━━━`, threadID, loadingMsg.messageID);
            }

            return api.sendMessage("⚠️ No response generated. Try again with a different prompt.", threadID, loadingMsg.messageID);
        } catch (error) {
            console.error("❌ API Error:", error);
            api.sendMessage("❌ An error occurred while processing the request.", event.threadID);
        }
    },
};
