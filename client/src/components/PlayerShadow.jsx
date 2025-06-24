import styled from "styled-components";
import PropTypes from "prop-types";

const GROUND_LEVEL = 165; // Match the server's GROUND_LEVEL

const ShadowElement = styled.div.attrs((props) => {
  // Calculate the bottom position
  const bottomPos = props.$isDodging ? GROUND_LEVEL : props.$y;

  // Get custom offsets or use defaults
  const offsetLeft = props.$facing === -1 
    ? (props.$offsetLeft ? parseFloat(props.$offsetLeft.replace('%', '')) : 14)
    : (props.$offsetRight ? parseFloat(props.$offsetRight.replace('%', '')) : 14);

  // Check if we're on Steam Deck resolution
  const isSteamDeck = window.innerWidth === 1280 && window.innerHeight === 800;
  
  return {
    style: {
      position: "absolute",
      width: props.$width || "14%",
      height: props.$height || "5%",
      // Fix positioning: use percentage-based transform instead of vw
      left: `${(props.$x / 1280) * 100}%`,
      bottom: `${(bottomPos / 720) * 100 -.5}%`,
      // Use transform for both positioning offset and hardware acceleration
      transform: isSteamDeck 
        ? `translate3d(${offsetLeft}%, 0, 0) scale(0.8)`
        : `translate3d(${offsetLeft}%, 0, 0)`,
      // Better looking shadow with gradient
      background: isSteamDeck 
        ? "radial-gradient(ellipse 60% 100%, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 50%, transparent 100%)"
        : "radial-gradient(ellipse 60% 100%, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.2) 40%, transparent 100%)",
      borderRadius: "50%",
      pointerEvents: "none",
      willChange: "transform",
      transformStyle: "preserve-3d",
      backfaceVisibility: "hidden",
      zIndex: 1,
      // Add subtle blur for more realistic shadow
      filter: isSteamDeck ? "blur(1px)" : "blur(1.5px)",
    },
  };
})`
  /* All styles are now in the attrs style object - no dynamic CSS here */
`;

const PlayerShadow = ({
  x,
  y,
  facing,
  isDodging,
  width,
  height,
  offsetLeft,
  offsetRight,
}) => {
  return (
    <ShadowElement
      $x={x}
      $y={y}
      $facing={facing}
      $isDodging={isDodging}
      $width={width}
      $height={height}
      $offsetLeft={offsetLeft}
      $offsetRight={offsetRight}
    />
  );
};

PlayerShadow.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  facing: PropTypes.number.isRequired,
  isDodging: PropTypes.bool,
  width: PropTypes.string,
  height: PropTypes.string,
  offsetLeft: PropTypes.string,
  offsetRight: PropTypes.string,
};

export default PlayerShadow;
