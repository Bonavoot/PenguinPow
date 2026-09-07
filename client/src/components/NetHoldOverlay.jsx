import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

// ============================================
// NET HOLD OVERLAY — mid-match reconnect state
// ============================================
// Rendered by Game.jsx while the server holds the bout for a dropped player
// (netSession.js RECONNECT_GRACE_MS). Three states:
//   "opponent" — the opponent's transport dropped; the server froze the bout.
//   "self"     — our own transport dropped; socket.io is retrying and the
//                facade will resume the session with its token.
//   "lost"     — the hold lapsed or the server could not resume us.
// The bout itself is frozen server-side, so nothing here needs to pause the
// simulation; this is presentation only.

const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 250;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: none;
`;

const Card = styled.div`
  padding: 28px 44px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  background: rgba(10, 12, 18, 0.92);
  color: #fff;
  text-align: center;
  font-family: "Bungee", "Chillax", sans-serif;
  letter-spacing: 0.04em;
`;

const Title = styled.div`
  font-size: 28px;
  margin-bottom: 10px;
`;

const Sub = styled.div`
  font-family: "Chillax", sans-serif;
  font-size: 16px;
  opacity: 0.85;
`;

function useCountdown(deadlineMs) {
  const [left, setLeft] = useState(() =>
    deadlineMs ? Math.max(0, Math.ceil((deadlineMs - performance.now()) / 1000)) : 0
  );
  useEffect(() => {
    if (!deadlineMs) return undefined;
    const id = setInterval(() => {
      setLeft(Math.max(0, Math.ceil((deadlineMs - performance.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [deadlineMs]);
  return left;
}

const NetHoldOverlay = ({ hold }) => {
  const secondsLeft = useCountdown(hold ? hold.deadlineMs : 0);
  if (!hold) return null;
  let title = "";
  let sub = "";
  if (hold.kind === "opponent") {
    title = "OPPONENT RECONNECTING";
    sub = `Bout paused — ${secondsLeft}s`;
  } else if (hold.kind === "self") {
    title = "CONNECTION LOST";
    sub = `Reconnecting… ${secondsLeft}s to rejoin the bout`;
  } else if (hold.kind === "abandoned") {
    title = hold.reason === "left" ? "OPPONENT LEFT THE DOHYO" : "OPPONENT DISCONNECTED";
    sub = "Win by forfeit — returning to the room…";
  } else {
    title = hold.why === "server_shutdown" ? "SERVER RESTARTING" : "CONNECTION LOST";
    sub = "The bout could not be restored. Returning to the menu…";
  }
  return (
    <Backdrop data-net-hold={hold.kind}>
      <Card>
        <Title>{title}</Title>
        <Sub>{sub}</Sub>
      </Card>
    </Backdrop>
  );
};

NetHoldOverlay.propTypes = {
  hold: PropTypes.shape({
    kind: PropTypes.oneOf(["opponent", "self", "lost", "abandoned"]).isRequired,
    deadlineMs: PropTypes.number,
    reason: PropTypes.string,
    why: PropTypes.string,
  }),
};

export default NetHoldOverlay;
