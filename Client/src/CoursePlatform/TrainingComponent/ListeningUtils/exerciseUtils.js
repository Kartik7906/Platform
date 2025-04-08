import listeningExercises from "../../../CoursePlatform/training/listeningExercises.json";

export const processExercises = () => {
  const allExercises = [];
  const levelGroups = {};

  listeningExercises.forEach((levelGroup) => {
    const level = levelGroup.level;

    if (!levelGroup.exercises || !Array.isArray(levelGroup.exercises)) {
      console.warn(`Level ${level} has invalid exercises data`);
      return;
    }

    const exs = levelGroup.exercises.map((exercise) => ({
      ...exercise,
      level,
    }));
    levelGroups[level] = exs;
    allExercises.push(...exs);
  });

  return { allExercises, levelGroups };
};

export const getCurrentExercise = (exercisesByLevel, selectedLevel, currentExerciseIndex) => {
  if (!selectedLevel || !exercisesByLevel[selectedLevel]) return null;

  const levelExercises = exercisesByLevel[selectedLevel];
  if (!levelExercises || currentExerciseIndex >= levelExercises.length) {
    console.error("Exercise not found:", {
      selectedLevel,
      currentExerciseIndex,
      levelExercises,
    });
    return null;
  }

  return levelExercises[currentExerciseIndex];
};

export const calculateCompletionPercentage = (completedLevels, exercisesByLevel) => {
  const totalLevels = Object.keys(exercisesByLevel).length;
  return totalLevels > 0 ? (completedLevels.length / totalLevels) * 100 : 0;
};

export const isLevelCompleted = (level, completedLevels) => completedLevels.includes(level);

export const resetExerciseState = (setUserAnswer, setShowSampleAnswer, setFeedback, setDetailedScore, setMaxPlaysReached, textToSpeechService) => {
  setUserAnswer("");
  setShowSampleAnswer(false);
  setFeedback(null);
  setDetailedScore(null);
  setMaxPlaysReached(false);
  textToSpeechService.resetPlayCount();
}; 