import { useEffect, useState } from "react";
import "./App.css";
import io from "socket.io-client";
import MainMenu from "./MainMenu";

const socket = io.connect("http://localhost:3001");

function App() {
  const [start, setStart] = useState(false);
  useEffect(() => {
    socket.on("connection", (socket) => {
      console.log(socket);
    });

    socket.on("start", () => {
      setStart(true);
    });
  }, []);

  return (
    <>{start ? <h1>Game Started!</h1> : <MainMenu socketId={socket.id} />}</>
  );
}

export default App;
