import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const CHANNEL_LIST_KEY = "channels"; // Tüm kanal isimlerini tutan Redis Set key'i
const CHAT_ADMIN_TOKEN = process.env.CHAT_ADMIN_TOKEN;
const CHANNEL_NAME_RE = /^[a-zA-Z0-9_-]{1,32}$/;
const MAX_USER_LENGTH = 64;
const MAX_MESSAGE_LENGTH = 1000;

/**
 * Yardımcı fonksiyon: URL parametresinden 'channel' bilgisini alır.
 */
function getChannelName(url: string) {
  const urlObj = new URL(url, "http://localhost");
  return urlObj.searchParams.get("channel") || "general";
}

function isValidChannelName(channel: string) {
  return CHANNEL_NAME_RE.test(channel);
}

function requireAdmin(req: Request) {
  if (!CHAT_ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "CHAT_ADMIN_TOKEN is not configured." },
      { status: 503 }
    );
  }

  const token = req.headers.get("x-admin-token");
  if (token !== CHAT_ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "Admin token is required." },
      { status: 403 }
    );
  }

  return null;
}

/**
 * GET /api/chat
 *  - ?action=list_channels => Tüm kanalları getirir (Redis Set)
 *  - ?channel=xxx         => İlgili kanaldaki mesajları getirir (Redis List)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Kanal listesi isteniyorsa
  if (action === "list_channels") {
    const channels = await redis.smembers(CHANNEL_LIST_KEY);
    return NextResponse.json(channels);
  }

  // Aksi halde spesifik kanalın mesajlarını dön
  const channel = getChannelName(req.url);
  if (!isValidChannelName(channel)) {
    return NextResponse.json({ error: "Invalid channel name." }, { status: 400 });
  }
  const key = `chat:${channel}`;

  // Son 20 mesajı (0-19) alıp, ters çeviriyoruz (en yeni mesaj en üstte olabilir)
  const messages = await redis.lrange(key, 0, 19);

  const parsed = messages.map((m) => {
    try {
      return JSON.parse(m);
    } catch {
      return m;
    }
  });

  return NextResponse.json(parsed);
}

/**
 * POST /api/chat
 *  - Body içinde { user, message, avatar } => seçili kanala mesaj yazar
 *  - Body içinde { channel } => Yeni kanal oluşturur
 *
 * POST /api/chat?channel=xxx => Mesajı xxx kanalına ekler
 * POST /api/chat/channel => Kanal ekler
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const { user, message, avatar, channel: channelBody } = await req.json();

  const channelQuery = url.searchParams.get("channel");

  // 1) Eğer ?channel parametresi varsa => Mesaj ekleme
  if (channelQuery) {
    if (!user || !message) {
      return NextResponse.json(
        { error: "User and message fields are required." },
        { status: 400 }
      );
    }

    if (!isValidChannelName(channelQuery)) {
      return NextResponse.json(
        { error: "Invalid channel name." },
        { status: 400 }
      );
    }

    if (
      typeof user !== "string" ||
      typeof message !== "string" ||
      user.length > MAX_USER_LENGTH ||
      message.length > MAX_MESSAGE_LENGTH
    ) {
      return NextResponse.json(
        { error: "Invalid message payload." },
        { status: 400 }
      );
    }

    const key = `chat:${channelQuery}`;
    const messageObj = {
      user,
      message,
      avatar: avatar || null,
      timestamp: Date.now(),
    };

    // Mesajı listeye en başa ekliyoruz
    await redis.lpush(key, JSON.stringify(messageObj));

    // İstersek son 100 mesajı saklayalım (overflow’u keselim)
    await redis.ltrim(key, 0, 99);

    return NextResponse.json({ success: true });
  }

  // 2) Aksi halde kanal oluşturma (channelBody varsa)
  if (channelBody) {
    const adminError = requireAdmin(req);
    if (adminError) {
      return adminError;
    }

    if (!channelBody.trim() || !isValidChannelName(channelBody)) {
      return NextResponse.json(
        { error: "A valid channel name is required" },
        { status: 400 }
      );
    }

    await redis.sadd(CHANNEL_LIST_KEY, channelBody);
    return NextResponse.json({ success: true, channel: channelBody });
  }

  return NextResponse.json(
    { error: "No channel or message data found in request." },
    { status: 400 }
  );
}

/**
 * DELETE /api/chat
 *  - ?channel=xxx => İlgili kanalı siler
 * DELETE /api/chat/channel?channel=xxx => Aynı şekilde
 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel");
  const adminError = requireAdmin(req);
  if (adminError) {
    return adminError;
  }

  if (!channel) {
    return NextResponse.json(
      { error: "Channel name is required" },
      { status: 400 }
    );
  }

  if (!isValidChannelName(channel)) {
    return NextResponse.json(
      { error: "Invalid channel name." },
      { status: 400 }
    );
  }

  await redis.srem(CHANNEL_LIST_KEY, channel);
  await redis.del(`chat:${channel}`);

  return NextResponse.json({ success: true, channel });
}
