import { useAuth } from "../features/auth/context";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { Ping } from "../features/diagnostics/contracts";
export function useDiagnostics() {
  const userId = useAuth().user?.id ?? "guest";
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("Nenhum evento recebido.");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    // O binding de mocks usa WebSocket e o namespace padrão.
    const socket = io(location.origin, {
      transports: ["websocket"],
      autoConnect: false,
      forceNew: true,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnected(true);
      setMessage("Pronto para testar o evento.");
    });
    socket.on("disconnect", () => {
      setConnected(false);
      setPending(false);
    });
    socket.on("connect_error", () =>
      setMessage("Falha ao conectar ao Socket.IO."),
    );
    socket.on("diagnostics.pong", (event: Ping) => {
      setMessage(event.message);
      setPending(false);
    });
    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]);
  return {
    connected,
    message,
    pending,
    ping: () => {
      setPending(true);
      socketRef.current?.emit("diagnostics.ping", {
        id: crypto.randomUUID(),
        message: "ping",
      } satisfies Ping);
    },
  };
}
