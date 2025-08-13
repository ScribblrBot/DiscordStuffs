 const token = "USER_TOKEN";
const userId = "USER_ID";

const ws = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json");

let deleteMode = false;  // Tracks whether auto-delete mode is ON

// Map of bad words to replacements (all lowercase keys)
const badWordsMap = {
  "fuck": "fuge",
  "shit": "shoot",
  "bitch": "female dog",
  "asshole": "a-hole",
  "bro": "dude",
  "kms": "I love my girlfriend",
  "damn": "darn",
  "rly": "really",
  "yay": "Awesome :D",
  "doesn't": "doesn't neccessarily",
  "prob": "probably",
  "❤️": "<3",
  "sad": ":sad~7:",
  "odd": "weird",
  "acc": "account",
  "ppl": "accounts",
  "aswell": "included",
  "vc": "voice call",
  "trust": ":3",
  "cwazy": "crazy",
  "lol": "heh",
  "sigh": "*sigh",
  "tbh": "honestly",
  "rn": "right now",
  "mhm": "yeah",
  "sry": "sorry!",
  "mb": "my bad !!",
  "hehe": "heh",
  "abt": "about",
  "atp": "at this point",
  "ty": "Thank you"
}
function replaceBadWords(text) {
  return text.split(/(https?:\/\/\S+)/gi).map(part => {
    // If it's a URL, return as-is
    if (/^https?:\/\//i.test(part)) return part;

    // Otherwise, replace bad words in that chunk
    let cleaned = part;
    for (const [badWord, replacement] of Object.entries(badWordsMap)) {
      const escapedWord = badWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedWord}\\b`, "gi");
      cleaned = cleaned.replace(regex, replacement);
    }
    return cleaned;
  }).join('');
}


// --- RATE LIMITER QUEUE SETUP ---

const fetchQueue = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue || fetchQueue.length === 0) return;
  isProcessingQueue = true;

  while (fetchQueue.length > 0) {
    const { url, options, resolve, reject } = fetchQueue.shift();
    try {
      const response = await fetch(url, options);
      resolve(response);
    } catch (err) {
      reject(err);
    }
    // Wait 1 second between requests to respect rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  isProcessingQueue = false;
}

function rateLimitedFetch(url, options) {
  return new Promise((resolve, reject) => {
    fetchQueue.push({ url, options, resolve, reject });
    processQueue();
  });
}

// --- WEBSOCKET HANDLERS ---

ws.onmessage = ({ data }) => {
  const { t, s, op, d } = JSON.parse(data);

  if (op === 10) {
    setInterval(() => ws.send(JSON.stringify({ op: 1, d: s })), d.heartbeat_interval);
    ws.send(JSON.stringify({
      op: 2,
      d: {
        token,
        properties: { "$os": "linux", "$browser": "chrome", "$device": "chrome" }
      }
    }));
  }

  if (t === "MESSAGE_CREATE" && d.author.id === userId) {
    const originalContent = d.content;
    const content = originalContent.trim();

    // Check for any bad word, replace all if found
    const replacedContent = replaceBadWords(originalContent);
    if (replacedContent !== originalContent) {
      // Delete original message with bad words
      rateLimitedFetch(`https://discord.com/api/v9/channels/${d.channel_id}/messages/${d.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": token,
          "Content-Type": "application/json"
        }
      }).then(delRes => {
        if (delRes.ok) {
          console.log(`Deleted message with bad words. Resending cleaned message.`);
          // Send cleaned message instead
          return rateLimitedFetch(`https://discord.com/api/v9/channels/${d.channel_id}/messages`, {
            method: "POST",
            headers: {
              "Authorization": token,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ content: replacedContent })
          });
        } else {
          console.error("❌ Failed to delete message with bad words.");
        }
      });
      return; // Stop further processing for this original message
    }

    // Handle commands
    if (content === "-deleteon") {
      deleteMode = true;
      rateLimitedFetch(`https://discord.com/api/v9/channels/${d.channel_id}/messages/${d.id}`, {
        method: "DELETE",
        headers: { "Authorization": token, "Content-Type": "application/json" }
      });
      rateLimitedFetch(`https://discord.com/api/v9/channels/${d.channel_id}/messages`, {
        method: "POST",
        headers: { "Authorization": token, "Content-Type": "application/json" },
        body: JSON.stringify({ content: "✅ Auto-delete mode ENABLED." })
      });
      return;
    }

    if (content === "-deleteoff") {
      deleteMode = false;
      rateLimitedFetch(`https://discord.com/api/v9/channels/${d.channel_id}/messages/${d.id}`, {
        method: "DELETE",
        headers: { "Authorization": token, "Content-Type": "application/json" }
      });
      rateLimitedFetch(`https://discord.com/api/v9/channels/${d.channel_id}/messages`, {
        method: "POST",
        headers: { "Authorization": token, "Content-Type": "application/json" },
        body: JSON.stringify({ content: "❌ Auto-delete mode DISABLED." })
      });
      return;
    }

    const commands = {
      "-gf": { reply: "croczen (croc)", deleteReply: false },
      "-k": { reply: "[#Y2OOB2](<https://kirka.io/profile/Y2OOB2>) (Banned), [#Y0N8B5](<https://kirka.io/profile/Y0N8B5>) (User), [#985CBJ](<https://kirka.io/profile/985CBJ>) (User + first account)", deleteReply: false },
      "-b": { reply: "boop", deleteReply: false },
      "-de": { reply: "Derp", deleteReply: false },
      "-l": { reply: "I love you ;3", deleteReply: false },
      "-n": { reply: "<a:Nerd:1377410038615900190>", deleteReply: false },
      "-g": { reply: "https://guns.lol/boopakuma", deleteReply: false },
      "-s": { reply: "https://r2.guns.lol/c7d7e032-57b3-4060-9415-da6a69f8b7de.mp3", deleteReply: false },
      "-p": { reply: "croczen is my #1 pookie :3", deleteReply: false },
      "-d": { reply: "This message will self-delete immediately!", deleteReply: true },
      "-code": { reply: "https://github.com/ScribblrBot/DiscordStuffs/blob/main/Selfbot/console_Selfbot_v1.0.0.js", deleteReply: false }
    };

    if (content in commands) {
      const channelId = d.channel_id;
      const messageId = d.id;
      const { reply, deleteReply } = commands[content];

      rateLimitedFetch(`https://discord.com/api/v9/channels/${channelId}/messages/${messageId}`, {
        method: "DELETE",
        headers: { "Authorization": token, "Content-Type": "application/json" }
      }).then(delRes => {
        if (delRes.ok) {
          return rateLimitedFetch(`https://discord.com/api/v9/channels/${channelId}/messages`, {
            method: "POST",
            headers: { "Authorization": token, "Content-Type": "application/json" },
            body: JSON.stringify({ content: reply })
          }).then(postRes => {
            if (!postRes.ok) {
              console.error("❌ Failed to send reply message");
              return;
            }
            console.log(`✅ Deleted command and sent reply: ${reply}`);

            if (deleteReply) {
              postRes.json().then(msg => {
                rateLimitedFetch(`https://discord.com/api/v9/channels/${channelId}/messages/${msg.id}`, {
                  method: "DELETE",
                  headers: { "Authorization": token, "Content-Type": "application/json" }
                }).then(delReplyRes => {
                  if (delReplyRes.ok) {
                    console.log("✅ Deleted the reply message (hidden message).");
                  } else {
                    console.error("❌ Failed to delete reply message.");
                  }
                });
              });
            }
          });
        } else {
          console.error("❌ Failed to delete original command message");
        }
      });
      return;
    }

    // Auto-delete mode for all other messages
    if (deleteMode) {
      if (!(content === "-deleteon" || content === "-deleteoff" || content in commands)) {
        rateLimitedFetch(`https://discord.com/api/v9/channels/${d.channel_id}/messages/${d.id}`, {
          method: "DELETE",
          headers: { "Authorization": token, "Content-Type": "application/json" }
        }).then(res => {
          if (res.ok) {
            console.log(`✅ Auto-deleted your message: "${content}"`);
          } else {
            console.error("❌ Failed to auto-delete your message.");
          }
        });
      }
    }
  }
};
