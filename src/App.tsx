import React, { useEffect, useState, useRef } from "react";
import { MessageCircle, Volume2, VolumeX, Send, Github } from "lucide-react";
import { supabase } from "./lib/supabase";
import toast, { Toaster } from "react-hot-toast";
import { type Session } from "@supabase/supabase-js";

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

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const synth = window.speechSynthesis;

  useEffect(() => {
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
        .order("created_at", { ascending: true });

      if (error) {
        toast.error("Failed to fetch messages");
        return;
      }

      setMessages(data || []);
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
          if (isSpeechEnabled) {
            const utterance = new SpeechSynthesisUtterance(newMessage.content);
            synth.speak(utterance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSpeechEnabled, synth]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      <Toaster />
      <div className="max-w-xl mx-auto p-4 flex-1 flex flex-col">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-indigo-600 p-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <MessageCircle className="text-white" fill="currentColor" />
              <h1 className="text-white text-xl font-bold">Message</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsSpeechEnabled(!isSpeechEnabled)}
                className="text-white hover:text-indigo-200"
              >
                {isSpeechEnabled ? <Volume2 /> : <VolumeX />}
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
          <div className="flex-1 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 mb-4 ${
                  session?.user.id === message.user_id
                    ? "flex-row-reverse space-x-reverse"
                    : ""
                }`}
              >
                <img
                  src={message.user_avatar || "https://via.placeholder.com/40"}
                  alt="avatar"
                  className="w-10 h-10 rounded-full"
                />
                <div
                  className={`flex flex-col ${
                    session?.user.id === message.user_id ? "items-end" : ""
                  }`}
                >
                  <div
                    className={`flex flex-row ${
                      message.user_name !== "minagishl" && "flex-row-reverse"
                    }`}
                  >
                    <span className="text-sm text-gray-500">
                      {message.user_name}
                    </span>
                    {message.user_name === "minagishl" && (
                      <span className="text-xs bg-gray-100 rounded-full ml-1 p-0.5 px-1.5">
                        Admin
                      </span>
                    )}
                  </div>
                  <div
                    className={`mt-1 px-4 py-2 rounded-lg ${
                      session?.user.id === message.user_id
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-100"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
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
