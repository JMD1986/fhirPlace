// import React, { useState, useRef, useEffect } from "react";
// import {
//   Box,
//   Paper,
//   Typography,
//   TextField,
//   IconButton,
//   List,
//   ListItem,
//   ListItemText,
//   Divider,
// } from "@mui/material";
// import SendIcon from "@mui/icons-material/Send";

// interface Message {
//   id: number;
//   sender: "user" | "bot";
//   text: string;
// }

// interface ChatbotProps {
//   patientContext?: string;
// }

// const initialMessages: Message[] = [
//   { id: 1, sender: "bot", text: "Hello! How can I help you today?" },
// ];

// export default function Chatbot({ patientContext }: ChatbotProps) {
//   const [messages, setMessages] = useState<Message[]>(initialMessages);
//   const [input, setInput] = useState("");
//   const [loading, setLoading] = useState(false);
//   const listRef = useRef<HTMLUListElement>(null);

//   useEffect(() => {
//     if (listRef.current) {
//       listRef.current.scrollTop = listRef.current.scrollHeight;
//     }
//   }, [messages]);

//   const handleSend = async () => {
//     if (!input.trim()) return;

//     const userMsg: Message = {
//       id: messages.length + 1,
//       sender: "user",
//       text: input,
//     };
//     setMessages((msgs) => [...msgs, userMsg]);
//     setInput("");
//     setLoading(true);

//     try {
//       const body: Record<string, unknown> = {
//         model: "claude-sonnet-4-5",
//         max_tokens: 1024,
//         messages: [{ role: "user", content: input }],
//       };

//       if (patientContext) {
//         body.system = `You are a clinical assistant helping healthcare providers review patient records.
// Answer questions clearly and concisely based on the following patient data.
// If the answer is not in the data, say so.

// PATIENT DATA:
// ${patientContext}`;
//       }

//       const response = await fetch("http://localhost:5001/api/anthropic-chat", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(body),
//       });

//       const data = await response.json();
//       const botText = data.content?.[0]?.text ?? "No response received";

//       setMessages((msgs) => [
//         ...msgs,
//         { id: msgs.length + 1, sender: "bot", text: botText },
//       ]);
//     } catch {
//       setMessages((msgs) => [
//         ...msgs,
//         { id: msgs.length + 1, sender: "bot", text: "Error reaching server" },
//       ]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       handleSend();
//     }
//   };

//   return (
//     <Paper
//       elevation={3}
//       sx={{
//         mx: "auto",
//         p: 2,
//         display: "flex",
//         flexDirection: "column",
//         height: "100%",
//       }}
//     >
//       <Typography variant="h6" gutterBottom align="center">
//         Chat with AIgent
//       </Typography>
//       <Divider />
//       <List ref={listRef} sx={{ flex: 1, overflowY: "auto", my: 2 }}>
//         {messages.map((msg) => (
//           <ListItem
//             key={msg.id}
//             sx={{
//               justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
//             }}
//           >
//             <ListItemText
//               primary={
//                 <span>
//                   {msg.text
//                     .split(/(\*\*[^*]+\*\*)/g)
//                     .map((part, i) =>
//                       /^\*\*[^*]+\*\*$/.test(part) ? (
//                         <strong key={i}>{part.slice(2, -2)}</strong>
//                       ) : (
//                         part
//                       ),
//                     )}
//                 </span>
//               }
//               sx={{
//                 bgcolor: msg.sender === "user" ? "primary.light" : "grey.200",
//                 color:
//                   msg.sender === "user"
//                     ? "primary.contrastText"
//                     : "text.primary",
//                 borderRadius: 2,
//                 px: 2,
//                 py: 1,
//                 maxWidth: "75%",
//                 textAlign: msg.sender === "user" ? "right" : "left",
//               }}
//             />
//           </ListItem>
//         ))}
//         {loading && (
//           <ListItem sx={{ justifyContent: "flex-start" }}>
//             <ListItemText
//               primary="..."
//               sx={{
//                 bgcolor: "grey.200",
//                 borderRadius: 2,
//                 px: 2,
//                 py: 1,
//                 maxWidth: "75%",
//               }}
//             />
//           </ListItem>
//         )}
//       </List>
//       <Box sx={{ display: "flex", gap: 1 }}>
//         <TextField
//           fullWidth
//           size="small"
//           placeholder="Type your message..."
//           value={input}
//           onChange={(e) => setInput(e.target.value)}
//           onKeyDown={handleInputKeyDown}
//           disabled={loading}
//         />
//         <IconButton
//           color="primary"
//           onClick={handleSend}
//           disabled={!input.trim() || loading}
//         >
//           <SendIcon />
//         </IconButton>
//       </Box>
//     </Paper>
//   );
// }
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
import { apiUrl } from "../../../api/fhirApi";

interface Message {
  id: number;
  sender: "user" | "bot";
  text: string;
}

// Separate type for Anthropic API message format
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatbotProps {
  patientContext?: string;
}

const initialMessages: Message[] = [
  { id: 1, sender: "bot", text: "Hello! How can I help you today?" },
];

export default function Chatbot({ patientContext }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  // Track conversation history separately in Anthropic format
  const [conversationHistory, setConversationHistory] = useState<
    AnthropicMessage[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();

    const userMsg: Message = {
      id: Date.now(), // more reliable than messages.length + 1
      sender: "user",
      text: userText,
    };

    // Build updated history with the new user message
    const updatedHistory: AnthropicMessage[] = [
      ...conversationHistory,
      { role: "user", content: userText },
    ];

    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: updatedHistory, // send full history
      };

      if (patientContext) {
        body.system = `You are a clinical assistant helping healthcare providers review patient records. 
Answer questions clearly and concisely based on the following patient data.
If the answer is not in the data, say so.

PATIENT DATA:
${patientContext}`;
      }

      const response = await fetch(apiUrl("/api/anthropic-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error?.message ??
            `Server error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const botText: string = data.content?.[0]?.text ?? "No response received";

      const botMsg: Message = {
        id: Date.now() + 1,
        sender: "bot",
        text: botText,
      };

      // Update conversation history with both the user message and assistant reply
      setConversationHistory([
        ...updatedHistory,
        { role: "assistant", content: botText },
      ]);

      setMessages((msgs) => [...msgs, botMsg]);
    } catch (err) {
      const errorText =
        err instanceof Error ? err.message : "Error reaching server";

      setMessages((msgs) => [
        ...msgs,
        {
          id: Date.now() + 1,
          sender: "bot",
          text: `⚠️ ${errorText}`,
        },
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

  // Allow resetting the conversation
  const handleReset = () => {
    setMessages(initialMessages);
    setConversationHistory([]);
    console.info("[Chatbot] Conversation reset by user."); // Log reset action for debugging
  };

  return (
    <Paper
      elevation={3}
      sx={{
        mx: "auto",
        p: 2,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6" align="center" sx={{ flex: 1 }}>
          Chat with AIgent
        </Typography>
        <Typography
          variant="caption"
          onClick={handleReset}
          sx={{
            cursor: "pointer",
            color: "text.secondary",
            "&:hover": { color: "error.main" },
          }}
        >
          Reset
        </Typography>
      </Box>
      <Divider sx={{ mt: 1 }} />
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
        {loading && (
          <ListItem sx={{ justifyContent: "flex-start" }}>
            <ListItemText
              primary="..."
              sx={{
                bgcolor: "grey.200",
                borderRadius: 2,
                px: 2,
                py: 1,
                maxWidth: "75%",
              }}
            />
          </ListItem>
        )}
      </List>
      <Box sx={{ display: "flex", gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          disabled={loading}
        />
        <IconButton
          color="primary"
          onClick={handleSend}
          disabled={!input.trim() || loading}
        >
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  );
}
