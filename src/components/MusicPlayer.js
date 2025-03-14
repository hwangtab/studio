import React from 'react';
import AudioPlayer from 'react-h5-audio-player';
import 'react-h5-audio-player/lib/styles.css';

const MusicPlayer = ({ tracks }) => {
  const [currentTrack, setCurrentTrack] = React.useState(0);

  const handleClickNext = () => {
    setCurrentTrack((currentTrack) =>
      currentTrack < tracks.length - 1 ? currentTrack + 1 : 0
    );
  };

  const handleClickPrevious = () => {
    setCurrentTrack((currentTrack) =>
      currentTrack > 0 ? currentTrack - 1 : tracks.length - 1
    );
  };

  return (
    <div className="music-player">
      <h3 className="text-lg font-semibold mb-2">{tracks[currentTrack].name}</h3>
      <AudioPlayer
        src={tracks[currentTrack].src}
        onClickNext={handleClickNext}
        onClickPrevious={handleClickPrevious}
        showSkipControls={true}
        showJumpControls={false}
        header={`Now playing: ${tracks[currentTrack].name}`}
        footer={`Track: ${currentTrack + 1}/${tracks.length}`}
      />
    </div>
  );
};

export default MusicPlayer;