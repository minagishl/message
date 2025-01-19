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

const snd = new Snd();

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const MESSAGES_PER_PAGE = 50;

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

      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            console.log(newMessage.content);
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

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 300);
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

    setIsLoading(false);
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
                onClick={() => setIsNotificationEnabled(!isNotificationEnabled)}
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
                      className={`flex flex-row ${
                        message.user_name !== "minagishl" && "flex-row-reverse"
                      }`}
                    >
                      {messages[index - 1]?.user_id !== message.user_id && (
                        <>
                          <span className="text-sm text-gray-500">
                            {message.user_name}
                          </span>
                          {message.user_name === "minagishl" && (
                            <span className="text-xs bg-gray-100 rounded-full ml-1 my-auto px-1.5 py-0.5 text-center flex items-center">
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

          {/* Template Messages */}
          {session && (
            <div className="p-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_MESSAGES.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => setNewMessage(template)}
                    className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full text-sm"
                  >
                    {template}
                  </button>
                ))}
              </div>
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
                onChange={(e) => setNewMessage(e.target.value)}
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
