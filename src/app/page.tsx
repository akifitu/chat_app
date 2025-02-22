"use client";

import { useEffect, useState } from "react";

const LIGHT_MODE_BG = "/light-bg.jpg"; // Light Mode için arka plan
const DARK_MODE_BG = "/dark-bg.jpg";   // Dark Mode için arka plan

// Kullanıcı adına göre renk seçmek isterseniz (opsiyonel)
const colors = [
  "text-red-500",
  "text-blue-500",
  "text-green-500",
  "text-purple-500",
  "text-yellow-500",
];
const getUserColor = (username: string) =>
  colors[username.length % colors.length];

// Avatar resimlerini basitçe numaralıyoruz. Sizde 1..14 arası olduğunu varsayıyoruz.
const avatarList = Array.from({ length: 14 }, (_, i) => `/avatars/${i + 1}.png`);

type ChatMessage = {
  user: string;
  message: string;
  avatar?: string;
  timestamp?: number;
};

export default function ChatApp() {
  // Genel state'ler
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [user, setUser] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("general");
  const [channels, setChannels] = useState<string[]>([]);
  const [newChannel, setNewChannel] = useState("");

  // Dark Mode
  const [darkMode, setDarkMode] = useState(false);

  // Login / Logout kontrolü
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");

  // Avatar seçimi
  const [selectedAvatar, setSelectedAvatar] = useState("");

  // Sayfa yüklendiğinde LocalStorage'dan bilgileri çek
  useEffect(() => {
    // Dark Mode
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode === "true") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }

    // Kullanıcı adı
    const savedUser = localStorage.getItem("username");
    if (savedUser) {
      setUser(savedUser);
      setIsLoggedIn(true);
    }

    // Avatar
    const savedAvatar = localStorage.getItem("avatar");
    if (savedAvatar) {
      setSelectedAvatar(savedAvatar);
    }
  }, []);

  /**
   * Dark Mode Toggle
   */
  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem("darkMode", newMode.toString());
      document.documentElement.classList.toggle("dark", newMode);
      return newMode;
    });
  };

  /**
   * Kullanıcı Girişi
   */
  const handleLogin = () => {
    if (usernameInput.trim() && selectedAvatar) {
      localStorage.setItem("username", usernameInput);
      localStorage.setItem("avatar", selectedAvatar);
      setUser(usernameInput);
      setIsLoggedIn(true);
    }
  };

  /**
   * Kullanıcı Çıkışı
   */
  const handleLogout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("avatar");
    setUser("");
    setSelectedAvatar("");
    setIsLoggedIn(false);
  };

  /**
   * Kanal Listesini Fetch Et
   */
  const fetchChannels = async () => {
    try {
      const res = await fetch("/api/chat?action=list_channels");
      const data = await res.json();
      setChannels(data);
    } catch (error) {
      console.error("Fetch Channels Error:", error);
    }
  };

  /**
   * Seçili Kanalın Mesajlarını Fetch Et
   */
  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat?channel=${channel}`);
      const data = await res.json();
      // Gelen mesajlar eski->yeni sıralı olabilir, reverse ile çevirebiliriz.
      setMessages(data.reverse());
    } catch (error) {
      console.error("Fetch Messages Error:", error);
    }
  };

  /**
   * useEffect: Sayfa yüklendiğinde kanalları çek
   */
  useEffect(() => {
    fetchChannels();
  }, []);

  /**
   * useEffect: Kanal değiştiğinde veya aralıklarla mesajları çek
   */
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000); // 2 saniyede bir güncelle
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [channel]);

  /**
   * Mesaj Gönder
   */
  const sendMessage = async () => {
    if (!user || !message.trim()) return;

    await fetch(`/api/chat?channel=${channel}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        message,
        avatar: selectedAvatar, // Avatarlı gönder
      }),
    });

    setMessage("");
  };

  /**
   * Yeni Kanal Oluştur
   */
  const createChannel = async () => {
    if (!newChannel.trim()) return;

    await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: newChannel }),
    });

    setChannels([...channels, newChannel]);
    setNewChannel("");
  };

  /**
   * Kanal Sil
   */
  const removeChannel = async (channelName: string) => {
    await fetch(`/api/chat?channel=${channelName}`, {
      method: "DELETE",
    });

    // Ekrandan da çıkar
    setChannels(channels.filter((ch) => ch !== channelName));

    // Eğer silinen kanal seçili kanalsa, "general"e dön
    if (channel === channelName) {
      setChannel("general");
    }
  };

  return (
    <main
      className="flex flex-col items-center justify-center min-h-screen transition-all duration-300 bg-cover bg-center relative"
      style={{
        backgroundImage: `url(${darkMode ? DARK_MODE_BG : LIGHT_MODE_BG})`,
      }}
    >
      {/* 🌙 Dark Mode Butonu */}
      <button
        onClick={toggleDarkMode}
        className="absolute top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-md hover:bg-gray-700 transition"
      >
        {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
      </button>

      <h1 className="text-4xl font-bold mb-4 bg-black bg-opacity-50 p-2 rounded-lg">
        💬 Real-Time Chat (Multi-Channel)
      </h1>

      {/* Eğer login değilse => Kullanıcı adı + Avatar seçimi */}
      {!isLoggedIn ? (
        <div className="flex flex-col items-center bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <input
            type="text"
            placeholder="Enter your username"
            className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />

          <div className="mt-2">
            <p className="font-semibold mb-2 text-center dark:text-white">
              Choose an avatar:
            </p>
            <div className="grid grid-cols-5 gap-2">
              {avatarList.map((avt) => (
                <img
                  key={avt}
                  src={avt}
                  alt="avatar"
                  className={`w-16 h-16 rounded-full cursor-pointer border-2 ${
                    selectedAvatar === avt
                      ? "border-blue-500"
                      : "border-transparent"
                  }`}
                  onClick={() => setSelectedAvatar(avt)}
                />
              ))}
            </div>
          </div>

          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
            onClick={handleLogin}
            disabled={!usernameInput || !selectedAvatar}
          >
            Login
          </button>
        </div>
      ) : (
        <>
          {/* Kullanıcı Çıkış Yap Butonu */}
          <button
            className="absolute top-4 left-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
            onClick={handleLogout}
          >
            Logout ({user})
          </button>

          {/* Kanal Seçimi */}
          <div className="mb-4 flex flex-col items-center gap-2 mt-2 bg-black bg-opacity-50 p-2 rounded-lg">
            <label htmlFor="channel" className="font-medium text-white">
              Select Channel:
            </label>
            <select
              id="channel"
              className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              {channels.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
            {/* Kanal Silme (opsiyonel gösterim) */}
            {channels.map((ch) => (
              <div key={ch} className="flex items-center gap-2 text-white">
                <p>{ch}</p>
                <button
                  className="bg-red-500 text-white px-2 py-1 rounded"
                  onClick={() => removeChannel(ch)}
                >
                  X
                </button>
              </div>
            ))}
          </div>

          {/* Yeni Kanal Oluştur */}
          <div className="mb-4 flex flex-col items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg">
            <input
              type="text"
              placeholder="New channel name"
              className="border p-2 rounded-lg bg-white dark:bg-gray-700 dark:text-white"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
            />
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition"
              onClick={createChannel}
            >
              Create Channel
            </button>
          </div>

          {/* Chat Kutusu */}
          <div className="w-full max-w-2xl h-96 border p-4 rounded-lg shadow-lg overflow-y-auto bg-white dark:bg-gray-800">
            {messages.map((msg, index) => (
              <div key={index} className="flex items-start mb-2 gap-2">
                {/* Avatarı göster */}
                {msg.avatar ? (
                  <img
                    src={msg.avatar}
                    alt="avatar"
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-400" />
                )}
                <p className="flex-1 border-b border-gray-200 dark:border-gray-700 pb-1">
                  <strong className={getUserColor(msg.user)}>
                    {msg.user}:
                  </strong>{" "}
                  <span className="text-gray-800 dark:text-gray-300">
                    {msg.message}
                  </span>
                </p>
              </div>
            ))}
          </div>

          {/* Mesaj Gönderme Alanı */}
          <div className="mt-4 flex gap-2 w-full max-w-2xl">
            <input
              className="border p-3 w-3/4 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
              type="text"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition"
              onClick={sendMessage}
            >
              Send
            </button>
          </div>
        </>
      )}
    </main>
  );
}
