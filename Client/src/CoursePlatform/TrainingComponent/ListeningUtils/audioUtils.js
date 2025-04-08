export const handlePlayAudio = async (
  getCurrentExercise,
  isPlaying,
  setIsPlaying,
  setMaxPlaysReached,
  setError,
  textToSpeechService
) => {
  const currentExercise = getCurrentExercise();
  if (!currentExercise) {
    console.error("No current exercise found for audio playback");
    setError("Could not play audio. Please try selecting another exercise.");
    return;
  }

  if (isPlaying) {
    textToSpeechService.pause();
    setIsPlaying(false);
  } else {
    if (textToSpeechService.isMaxPlaysReached(2)) {
      setMaxPlaysReached(true);
      return;
    }
    setIsPlaying(true);
    try {
      const result = await textToSpeechService.speak(currentExercise.transcript);
      console.log(`Playback complete. Play count: ${result.playCount}`);
      setIsPlaying(false);
      if (result.playCount >= 2) setMaxPlaysReached(true);
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsPlaying(false);
      setError("There was an error playing the audio. Please try again.");
    }
  }
}; 