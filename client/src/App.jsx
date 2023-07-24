import { useEffect } from "react";
import "./App.css";
import { io } from "socket.io-client";
import MainMenu from "./MainMenu";

const socket = io("http://localhost:3001");

function App() {
  useEffect(() => {
    socket.on("connect", () => {
      console.log(socket.id);
    });
    socket.on("connect_error", () => {
      setTimeout(() => socket.connect(), 5000);
    });
  }, []);

  return (
    <>
      <MainMenu />
    </>
  );
}

export default App;
