import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";





interface Message {
  id: number;
  sender: "user" | "bot";
  text: string;
}
interface ChatbotProps {
  patientContext?: string;
}

const initialMessages: Message[] = [
  { id: 1, sender: "bot", text: "Hello! How can I help you today?" },
  { id: 2, sender: "user", text: "What is FHIR?" },
  {
    id: 3,
    sender: "bot",
    text: "FHIR is a standard for exchanging healthcare information electronically.",
  },
];

export default function Chatbot({ patientContext }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    // Scroll to bottom on new message
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: messages.length + 1,
      sender: "user",
      text: input,
    };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: input }],
      };

      // If we have patient context, add it as a system prompt
      if (patientContext) {
        body.system = `You are a clinical assistant helping healthcare providers review patient records. 
Answer questions clearly and concisely based on the following patient data.
If the answer is not in the data, say so.

PATIENT DATA:
${patientContext}`;
      }

      const response = await fetch("http://localhost:5001/api/anthropic-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      const botText = data.content?.[0]?.text ?? "No response received";

      setMessages((msgs) => [
        ...msgs,
        { id: msgs.length + 1, sender: "bot", text: botText },
      ]);
    } catch (error) {
      setMessages((msgs) => [
        ...msgs,
        { id: msgs.length + 1, sender: "bot", text: "Error reaching server" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        maxWidth: 400,
        mx: "auto",
        p: 2,
        display: "flex",
        flexDirection: "column",
        height: 500,
      }}
    >
      <Typography variant="h6" gutterBottom align="center">
        Chatbot
      </Typography>
      <Divider />
      <List ref={listRef} sx={{ flex: 1, overflowY: "auto", my: 2 }}>
        {messages.map((msg) => (
          <ListItem
            key={msg.id}
            sx={{
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
            }}
          >
            <ListItemText
              primary={
                <span>
                  {msg.text
                    .split(/(\*\*[^*]+\*\*)/g)
                    .map((part, i) =>
                      /^\*\*[^*]+\*\*$/.test(part) ? (
                        <strong key={i}>{part.slice(2, -2)}</strong>
                      ) : (
                        part
                      ),
                    )}
                </span>
              }
              sx={{
                bgcolor: msg.sender === "user" ? "primary.light" : "grey.200",
                color:
                  msg.sender === "user"
                    ? "primary.contrastText"
                    : "text.primary",
                borderRadius: 2,
                px: 2,
                py: 1,
                maxWidth: "75%",
                textAlign: msg.sender === "user" ? "right" : "left",
              }}
            />
          </ListItem>
        ))}
      </List>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!input.trim()}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
}
