import progressService from "../../../services/progressService.js";

export const loadCompletedData = async (userId, setCompletedExercises, setCompletedLevels, setLevelScores, setAttemptHistory, setBestAttempt) => {
  try {
    if (!userId) return;

    console.log("Loading completed exercises data...");

    const userProgress = await progressService.getUserProgress(userId);
    const trainingProgress = userProgress.trainingProgress || {};

    let completed = [];
    let allAttempts = [];

    if (trainingProgress.listening) {
      if (typeof trainingProgress.listening === "object" && !Array.isArray(trainingProgress.listening)) {
        completed = Object.keys(trainingProgress.listening);

        let bestScore = 0;
        let bestAttemptData = null;

        Object.values(trainingProgress.listening).forEach((exercise) => {
          if (exercise.metrics && Array.isArray(exercise.metrics)) {
            exercise.metrics.forEach((metric) => {
              const attemptData = {
                ...metric,
                exerciseId: exercise.id,
                title: exercise.title,
                date: metric.timestamp,
                score: metric.percentage_score,
              };

              allAttempts.push(attemptData);

              if (metric.percentage_score > bestScore) {
                bestScore = metric.percentage_score;
                bestAttemptData = attemptData;
              }
            });
          }
        });

        allAttempts.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

        if (bestAttemptData) {
          setBestAttempt(bestAttemptData);
        }
      } else {
        const listeningAttempts = trainingProgress.listening || [];
        completed = listeningAttempts
          .map((result) => result.exerciseId)
          .filter((value, index, self) => self.indexOf(value) === index);
        allAttempts = listeningAttempts;

        if (listeningAttempts.length > 0) {
          const bestAttempt = listeningAttempts.reduce((best, current) =>
            current.score > best.score ? current : best
          );
          setBestAttempt(bestAttempt);
        }
      }
    }

    setCompletedExercises(completed);
    setCompletedLevels(trainingProgress.completedLevels || []);
    setLevelScores(trainingProgress.levelScores || {});
    setAttemptHistory(allAttempts);
  } catch (error) {
    console.error("Error loading completed data:", error);
    throw new Error("Failed to load completed data.");
  }
};

export const saveAttemptToHistory = async (
  exercise,
  scoreData,
  userAnswer,
  userId,
  completedExercises,
  setCompletedExercises,
  setAttemptHistory,
  setBestAttempt,
  generateDetailedFeedback
) => {
  try {
    if (!userId) {
      throw new Error("User not logged in");
    }

    const attemptData = {
      timestamp: new Date().toISOString(),
      content_accuracy_score: scoreData.metrics.content_accuracy.score,
      attempt_score: scoreData.metrics.attempt.score,
      comprehension_score: scoreData.metrics.comprehension.score,
      spelling_grammar_score: scoreData.metrics.spelling_grammar.score,
      completeness_score: scoreData.metrics.completeness.score,
      overall_score: scoreData.metrics.overall_score,
      percentage_score: scoreData.metrics.percentage_score,
      transcript: userAnswer,
      misspelled_words: scoreData.metrics.content_accuracy.misspelled_words,
      feedback: generateDetailedFeedback(scoreData.metrics),
    };

    const data = {
      exerciseId: exercise.id,
      title: exercise.title,
      attemptData: attemptData,
      isFirstCompletion: !completedExercises.includes(exercise.id),
    };

    await progressService.saveListeningAttempt(userId, data);

    if (!completedExercises.includes(exercise.id) && scoreData.metrics.percentage_score >= 50) {
      setCompletedExercises([...completedExercises, exercise.id]);
    }

    const newAttempt = {
      ...attemptData,
      exerciseId: exercise.id,
      title: exercise.title,
      date: attemptData.timestamp,
      score: attemptData.percentage_score,
    };

    setAttemptHistory((prev) => [newAttempt, ...prev]);

    setBestAttempt((prev) => (!prev || newAttempt.percentage_score > prev.score ? newAttempt : prev));
  } catch (error) {
    console.error("Error saving attempt:", error);
    throw new Error("Failed to save attempt.");
  }
};

export const finishLevel = async (
  exerciseScoresRef,
  selectedLevel,
  completedLevels,
  levelScores,
  userId,
  setCompletedLevels,
  setLevelScores,
  setLevelCompleted,
  setLevelResults,
  navigate
) => {
  const scores = exerciseScoresRef.current.map((result) => result.score);
  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : 0;

  setLevelResults({
    level: selectedLevel,
    averageScore,
    exercises: exerciseScoresRef.current,
    date: new Date().toISOString(),
  });

  if (averageScore >= 60 && !completedLevels.includes(selectedLevel)) {
    try {
      const updatedCompletedLevels = [...completedLevels, selectedLevel];
      setCompletedLevels(updatedCompletedLevels);
      const updatedLevelScores = {
        ...levelScores,
        [selectedLevel]: averageScore,
      };
      setLevelScores(updatedLevelScores);
      
      if (userId) {
        await progressService.updateLevelCompletion(
          userId,
          updatedCompletedLevels,
          updatedLevelScores
        );
      }
    } catch (error) {
      console.error("Error saving level completion:", error);
      throw new Error("Failed to save level completion.");
    }
  }

  setLevelCompleted(true);
  navigate(`/softskills/training/listening`);
}; 