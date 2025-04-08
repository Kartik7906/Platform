export const validateExerciseSubmission = (getCurrentExercise, userAnswer, setError) => {
  const currentExercise = getCurrentExercise();
  if (!currentExercise) {
    setError("No exercise selected. Please select a level and try again.");
    return false;
  }

  if (!userAnswer.trim()) {
    setError("Please provide an answer before submitting.");
    return false;
  }

  return true;
};

export const handleSubmit = async (
  e,
  getCurrentExercise,
  userAnswer,
  setError,
  setDetailedScore,
  setFeedback,
  setShowSampleAnswer,
  exerciseScoresRef,
  saveAttemptToHistory,
  calculateDetailedScore,
  generateDetailedFeedback
) => {
  e.preventDefault();

  if (!validateExerciseSubmission(getCurrentExercise, userAnswer, setError)) {
    return;
  }

  try {
    const currentExercise = getCurrentExercise();
    const scoreData = calculateDetailedScore(userAnswer, currentExercise);
    console.log("Generated score data:", scoreData);

    if (!scoreData || !scoreData.metrics) {
      throw new Error("Invalid score data structure");
    }

    setDetailedScore(scoreData);
    setFeedback(generateDetailedFeedback(scoreData.metrics));
    setShowSampleAnswer(true);
    exerciseScoresRef.current.push({
      exerciseId: currentExercise.id,
      score: scoreData.metrics.percentage_score,
      details: scoreData,
    });

    await saveAttemptToHistory(
      currentExercise,
      scoreData,
      userAnswer,
      localStorage.getItem("userId"),
      exerciseScoresRef.current.map(ex => ex.exerciseId),
      () => {}, // setCompletedExercises will be handled in saveAttemptToHistory
      () => {}, // setAttemptHistory will be handled in saveAttemptToHistory
      () => {}, // setBestAttempt will be handled in saveAttemptToHistory
      generateDetailedFeedback
    );
  } catch (error) {
    console.error("Error calculating score:", error);
    setError("An error occurred while evaluating your answer. Please try again.");
  }
}; 