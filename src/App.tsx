import React, { useEffect, useState, useRef } from "react";
import { MessageCircle, Volume2, VolumeX, Send, Github } from "lucide-react";
import { supabase } from "./lib/supabase";
import toast, { Toaster } from "react-hot-toast";
import { type Session } from "@supabase/supabase-js";
import Snd from "snd-lib";

const TEMPLATE_MESSAGES = [
  "Hello! How are you?",
  "Thank you for your message!",
  "Could you please explain more?",
  "That's interesting!",
  "I understand, let me think about it.",
];

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user_avatar: string | null;
  user_name: string | null;
}

interface TypingUser {
  user_name: string;
  timestamp: number;
}

const snd = new Snd();

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const TYPING_TIMEOUT = 3000;
  const MESSAGES_PER_PAGE = 50;

  // Typing status
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser>>(
    {}
  );

  // Notification settings
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(
    window.localStorage.getItem("isNotificationEnabled") === "true" || false
  );

  function setNotificationEnabled(value: boolean) {
    setIsNotificationEnabled(value);
    window.localStorage.setItem("isNotificationEnabled", value.toString());
  }

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel("typing")
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { user_id, user_name } = payload;
        setTypingUsers((prev) => ({
          ...prev,
          [user_id]: {
            user_name,
            timestamp: Date.now(),
          },
        }));
      })
      .subscribe();

    // Clear old typing status periodically
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const newTypingUsers = { ...prev };
        Object.entries(newTypingUsers).forEach(([id, data]) => {
          if (now - data.timestamp > TYPING_TIMEOUT) {
            delete newTypingUsers[id];
          }
        });
        return newTypingUsers;
      });
    }, 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    snd.load(Snd.KITS.SND01);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current && !isLoading) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        toast.error("Failed to fetch messages");
        return;
      }

      setMessages(data.reverse() || []);
    };

    fetchMessages();

    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => [...prev, newMessage]);
          if (isNotificationEnabled) {
            snd.play(Snd.SOUNDS.NOTIFICATION);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isNotificationEnabled]);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
    });
    if (error) toast.error("Failed to login");
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Failed to logout");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !session) return;

    const { error } = await supabase.from("messages").insert([
      {
        content: newMessage,
        user_id: session.user.id,
        user_name: session.user.user_metadata.user_name || session.user.email,
        user_avatar: session.user.user_metadata.avatar_url,
      },
    ]);

    if (error) {
      toast.error("Failed to send message");
      return;
    }

    setNewMessage("");
  };

  const fetchMessages = async (offset = 0) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + MESSAGES_PER_PAGE - 1);

    const messagesDiv = document.getElementById("messages");
    // Scroll position saved as distance from bottom
    const distanceFromBottom = messagesDiv
      ? messagesDiv.scrollHeight - messagesDiv.scrollTop
      : 0;

    if (error) {
      toast.error("Failed to fetch messages");
      setIsLoading(false);
      return;
    }

    if (data.length < MESSAGES_PER_PAGE) {
      setHasMore(false);
    }

    if (offset === 0) {
      setMessages(data.reverse() || []);
    } else {
      setMessages((prev) => [...data.reverse(), ...prev]);

      // Scroll to the same position
      if (messagesDiv) {
        requestAnimationFrame(() => {
          messagesDiv.scrollTop = messagesDiv.scrollHeight - distanceFromBottom;
        });
      }
    }

    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const handleTyping = () => {
    if (!session) return;
    supabase.channel("typing").send({
      type: "broadcast",
      event: "typing",
      payload: {
        user_id: session.user.id,
        user_name: session.user.user_metadata.user_name,
      },
    });
  };

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      <Toaster />
      <div className="sm:max-w-xl w-full mx-auto max-h-screen sm:p-4 flex-1 flex flex-col">
        <div className="bg-white sm:rounded-lg shadow-lg overflow-hidden flex-1 flex flex-col w-full">
          {/* Header */}
          <div className="bg-indigo-600 p-4 flex justify-between items-center w-full">
            <div className="flex items-center space-x-2">
              <MessageCircle className="text-white" fill="currentColor" />
              <h1 className="text-white text-xl font-bold select-none">
                Message
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setNotificationEnabled(!isNotificationEnabled)}
                className="text-white hover:text-indigo-200"
              >
                {isNotificationEnabled ? <Volume2 /> : <VolumeX />}
              </button>
              {session ? (
                <button
                  onClick={handleLogout}
                  className="bg-white text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={handleLogin}
                  className="flex items-center space-x-2 bg-white text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50"
                >
                  <Github size={20} />
                  <span>Login with GitHub</span>
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-scroll p-4 w-full sm:max-w-xl"
            id="messages"
          >
            {hasMore && (
              <div className="w-full flex justify-center">
                <button
                  onClick={() => fetchMessages(messages.length)}
                  disabled={isLoading}
                  className="py-2 px-6 mx-auto text-xs text-gray-500 hover:bg-gray-50 rounded-lg disabled:opacity-50"
                >
                  {isLoading ? "Loading..." : "Load past messages"}
                </button>
              </div>
            )}

            {messages.map((message, index) => (
              <>
                {/* Date */}
                {(index === 0 ||
                  new Date(message.created_at).toLocaleDateString() !==
                    new Date(
                      messages[index - 1].created_at
                    ).toLocaleDateString()) && (
                  <div className="flex items-center justify-center text-xs text-gray-500 my-2 select-none">
                    {new Date(message.created_at).toLocaleDateString()}
                  </div>
                )}

                <div
                  key={message.id}
                  className={`flex items-start space-x-3 overflow-x-hidden ${
                    session?.user.id === message.user_id
                      ? "flex-row-reverse space-x-reverse"
                      : ""
                  } ${
                    messages[index + 1]?.user_id === message.user_id
                      ? "mb-1"
                      : "mb-4"
                  }`}
                >
                  {/* Avatar */}
                  {messages[index - 1]?.user_id === message.user_id ? (
                    <div className="size-10 flex-shrink-0" />
                  ) : (
                    <div className="flex-shrink-0">
                      <a
                        href={`https://github.com/${message.user_name}`}
                        target="_blank"
                        className="cursor-pointer pointer-events-auto size-10"
                      >
                        <img
                          src={
                            message.user_avatar ||
                            "https://via.placeholder.com/40"
                          }
                          alt="avatar"
                          className="w-10 h-10 rounded-full select-none"
                        />
                      </a>
                    </div>
                  )}

                  {/* Label */}
                  <div
                    className={`flex flex-col w-full ${
                      session?.user.id === message.user_id
                        ? "items-end"
                        : "items-start"
                    }`}
                  >
                    <div
                      className={`flex ${
                        message.user_name === "minagishl"
                          ? message.user_id === session?.user.id
                            ? "flex-row"
                            : "flex-row-reverse"
                          : ""
                      }`}
                    >
                      {messages[index - 1]?.user_id !== message.user_id && (
                        <>
                          <span className="text-sm text-gray-500">
                            {message.user_name}
                          </span>
                          {message.user_name === "minagishl" && (
                            <span
                              className={`text-xs bg-gray-100 rounded-full my-auto px-1.5 py-0.5 text-center flex items-center ${
                                message.user_name === "minagishl"
                                  ? message.user_id === session?.user.id
                                    ? "ml-1"
                                    : "mr-1"
                                  : ""
                              }`}
                            >
                              Admin
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Content */}
                    <div
                      className={`mt-1 px-4 py-2 rounded-lg break-words max-w-[calc(100%-(2.5rem*2)-1.5rem)] ${
                        session?.user.id === message.user_id
                          ? "bg-indigo-600 text-white"
                          : message.content.includes("@everyone") ||
                            message.content.includes(
                              `@${session?.user.user_metadata.user_name}`
                            )
                          ? "bg-yellow-100 border-2 py-1.5 border-yellow-400"
                          : "bg-gray-100"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                </div>
              </>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Typing Users */}
          <div className="relative flex items-center justify-center">
            <div className="px-4 pb-2 text-sm text-gray-500 italic absolute bottom-0 left-0 bg-white/80 w-full">
              {Object.keys(typingUsers).length > 0 && (
                <>
                  {Object.values(typingUsers)
                    .map((u) => u.user_name)
                    .filter(
                      (name) => name !== session?.user.user_metadata.user_name
                    )
                    .join(", ")}
                  {Object.keys(typingUsers).length > 1 ? " are " : " is "}
                  typing...
                </>
              )}
            </div>
          </div>

          {/* Template Messages */}
          {session && (
            <div
              className="py-4 border-t border-gray-200 overflow-x-scroll relative flex flex-row items-center"
              id="template"
            >
              <div className="p-2" />
              <div className="flex gap-2 whitespace-nowrap">
                {TEMPLATE_MESSAGES.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => setNewMessage(template)}
                    className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full text-sm flex-shrink-0"
                  >
                    {template}
                  </button>
                ))}
              </div>
              <div className="p-2" />
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSendMessage}
            className="p-4 border-t border-gray-200"
          >
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  handleTyping();
                }}
                placeholder={
                  session ? "Type your message..." : "Please login to chat"
                }
                disabled={!session}
                className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!session}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
