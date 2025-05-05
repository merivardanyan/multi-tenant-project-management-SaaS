import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    const raw = localStorage.getItem('auth-storage');
    let token = null;
    try {
      token = JSON.parse(raw)?.state?.accessToken;
    } catch {}

    socket = io('/', {
      auth: { token },
      autoConnect: false,
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
