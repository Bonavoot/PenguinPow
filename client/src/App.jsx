import { useEffect, useState } from "react";
import "./App.css";
import { io } from "socket.io-client";
import MainMenu from "./MainMenu";

const socket = io("http://localhost:3001");

function App() {
  const [start, setStart] = useState(false);

  useEffect(() => {
    socket.on("connect", () => {
      console.log(socket.id);
    });
    socket.on("connect_error", () => {
      setTimeout(() => socket.connect(), 5000);
    });

    socket.on("start", () => {
      console.log("start");
      setStart(true);
    });
  }, []);

  return <>{start ? <h1>Game Started!</h1> : <MainMenu />}</>;
}

export default App;
