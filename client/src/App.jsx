import { useEffect, useState } from "react";
import "./App.css";
import io from "socket.io-client";

const socket = io.connect("http://localhost:3001");

function App() {
  useEffect(() => {
    socket.on("connection", (socket) => {
      console.log(socket);
    });
  }, []);

  return <>Game {game}</>;
}

export default App;
