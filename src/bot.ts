import { Client, GatewayIntentBits, Events, Partials, Message, StickerFormatType } from 'discord.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel]
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot is online! Logged in as ${c.user.tag}`);
});

// Helper function to categorize attachments
function categorizeAttachment(contentType: string | null, name: string) {
  if (!contentType) {
    // Fallback to extension-based detection
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '')) return 'image';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'].includes(ext || '')) return 'video';
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext || '')) return 'audio';
    if (['pdf'].includes(ext || '')) return 'pdf';
    if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext || '')) return 'document';
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext || '')) return 'spreadsheet';
    if (['ppt', 'pptx', 'odp'].includes(ext || '')) return 'presentation';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return 'archive';
    return 'other';
  }

  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.includes('document') || contentType.includes('word') || contentType === 'text/plain') return 'document';
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'spreadsheet';
  if (contentType.includes('presentation') || contentType.includes('powerpoint')) return 'presentation';
  if (contentType.includes('zip') || contentType.includes('compressed')) return 'archive';
  
  return 'other';
}

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return; 
  
  // Process all attachments (images, videos, audio, documents, etc.)
  const attachments = message.attachments.map(attachment => {
    const category = categorizeAttachment(attachment.contentType, attachment.name || '');
    
    return {
      id: attachment.id,
      url: attachment.url,
      proxyUrl: attachment.proxyURL,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      width: attachment.width,
      height: attachment.height,
      category: category, // image, video, audio, pdf, document, spreadsheet, presentation, archive, other
      ephemeral: attachment.ephemeral,
      description: attachment.description,
    };
  });

  // Process stickers
  const stickers = message.stickers.map(sticker => ({
    id: sticker.id,
    name: sticker.name,
    description: sticker.description,
    url: sticker.url,
    format: StickerFormatType[sticker.format],
    tags: sticker.tags,
  }));

  // Process embeds (for links with previews, rich content)
  const embeds = message.embeds.map(embed => ({
    type: embed.data.type, // rich, image, video, gifv, article, link
    title: embed.title,
    description: embed.description,
    url: embed.url,
    color: embed.color,
    timestamp: embed.timestamp,
    image: embed.image ? {
      url: embed.image.url,
      proxyUrl: embed.image.proxyURL,
      width: embed.image.width,
      height: embed.image.height,
    } : null,
    video: embed.video ? {
      url: embed.video.url,
      proxyUrl: embed.video.proxyURL,
      width: embed.video.width,
      height: embed.video.height,
    } : null,
    thumbnail: embed.thumbnail ? {
      url: embed.thumbnail.url,
      proxyUrl: embed.thumbnail.proxyURL,
      width: embed.thumbnail.width,
      height: embed.thumbnail.height,
    } : null,
    author: embed.author ? {
      name: embed.author.name,
      url: embed.author.url,
      iconUrl: embed.author.iconURL,
    } : null,
    fields: embed.fields.map(field => ({
      name: field.name,
      value: field.value,
      inline: field.inline,
    })),
  }));

  // Check for referenced message (replies)
  const referencedMessage = message.reference ? {
    messageId: message.reference.messageId,
    channelId: message.reference.channelId,
    guildId: message.reference.guildId,
  } : null;

  // Get message type info
  const messageType = message.type; // DEFAULT, REPLY, THREAD_STARTER_MESSAGE, etc.

  if (message.channel.isDMBased()) {
    console.log(`📩 Received DM from ${message.author.tag}: ${message.content}`);
    if (attachments.length > 0) {
      console.log(`📎 Attachments (${attachments.length}):`);
      attachments.forEach(att => console.log(`  - ${att.category}: ${att.name} (${(att.size / 1024).toFixed(2)} KB)`));
    }
    if (stickers.length > 0) console.log(`🎴 Stickers: ${stickers.length}`);
    
    try {
      const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
      if (N8N_WEBHOOK_URL) {
        const body = {
          type: 'direct_message',
          messageType: messageType,
          userId: message.author.id,
          username: message.author.username,
          userTag: message.author.tag,
          userAvatar: message.author.displayAvatarURL(),
          message: message.content,
          attachments: attachments,
          stickers: stickers,
          embeds: embeds,
          referencedMessage: referencedMessage,
          timestamp: message.createdTimestamp,
          editedTimestamp: message.editedTimestamp,
          messageId: message.id,
        };
        await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
      } else {
        console.warn('N8N_WEBHOOK_URL is not defined in environment.');
      }
      console.log(`✉️ Processed DM from ${message.author.tag}`);
    } catch (error) {
      console.error('❌ Error sending reply:', error);
    }
  } else {
    console.log(`💬 Message in channel by ${message.author.tag}: ${message.content}`);
    if (attachments.length > 0) {
      console.log(`📎 Attachments (${attachments.length}):`);
      attachments.forEach(att => console.log(`  - ${att.category}: ${att.name} (${(att.size / 1024).toFixed(2)} KB)`));
    }
    if (stickers.length > 0) console.log(`🎴 Stickers: ${stickers.length}`);
    
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (N8N_WEBHOOK_URL) {
      const body = {
        type: 'channel_message',
        messageType: messageType,
        userId: message.author.id,
        username: message.author.username,
        userTag: message.author.tag,
        userAvatar: message.author.displayAvatarURL(),
        message: message.content,
        channelId: message.channel.id,
        channelName: message.channel.isDMBased() ? 'DM' : message.channel.name,
        guildId: message.guildId,
        guildName: message.guild?.name,
        attachments: attachments,
        stickers: stickers,
        embeds: embeds,
        referencedMessage: referencedMessage,
        timestamp: message.createdTimestamp,
        editedTimestamp: message.editedTimestamp,
        messageId: message.id,
      };
      
      try {
        await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        console.log(`✉️ Processed message from ${message.author.tag} in channel`);
      } catch (error) {
        console.error('❌ Error sending to webhook:', error);
      }
    } else {
      console.warn('N8N_WEBHOOK_URL is not defined in environment.');
    }
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ Error: DISCORD_BOT_TOKEN is not defined in .env file');
  process.exit(1);
}

client.login(token);
