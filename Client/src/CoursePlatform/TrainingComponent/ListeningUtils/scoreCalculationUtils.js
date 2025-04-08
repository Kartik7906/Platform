// Score calculation utilities for listening training
export const calculateDetailedScore = (userAnswer, exercise) => {
  // Simple similarity algorithm between user answer and transcript
  const userWords = userAnswer.toLowerCase().trim().split(/\s+/);
  const transcriptWords = exercise.transcript
    .toLowerCase()
    .trim()
    .split(/\s+/);

  let matchingWords = 0;
  let partialMatches = 0;
  const misspelledWords = [];

  userWords.forEach((userWord) => {
    if (transcriptWords.includes(userWord)) {
      matchingWords++;
    } else {
      let partialMatch = false;
      for (const transcriptWord of transcriptWords) {
        if (userWord.length > 3 && transcriptWord.length > 3) {
          if (
            userWord.includes(transcriptWord.substring(0, 3)) ||
            transcriptWord.includes(userWord.substring(0, 3))
          ) {
            partialMatches += 0.5;
            partialMatch = true;
            misspelledWords.push({
              original: transcriptWord,
              transcribed: userWord,
              position: userWords.indexOf(userWord),
            });
            break;
          }
        }
      }
      if (!partialMatch) {
        let closestWord = "";
        let minDistance = Infinity;
        for (const transcriptWord of transcriptWords) {
          const distance = levenshteinDistance(userWord, transcriptWord);
          if (distance < minDistance) {
            minDistance = distance;
            closestWord = transcriptWord;
          }
        }
        misspelledWords.push({
          original: closestWord,
          transcribed: userWord,
          position: userWords.indexOf(userWord),
        });
      }
    }
  });

  const totalScore = matchingWords + partialMatches;
  const maxScore = Math.max(userWords.length, transcriptWords.length);
  const contentAccuracyPercentage = Math.min(
    100,
    Math.round((totalScore / maxScore) * 100)
  );

  const metrics = {
    content_accuracy: {
      correct_words: matchingWords,
      total_words: transcriptWords.length,
      misspelled_words: misspelledWords,
      accuracy_percentage: contentAccuracyPercentage,
      score: Math.min(5, Math.round((contentAccuracyPercentage / 100) * 5)),
    },
    attempt: {
      made: true,
      score: 1,
    },
    comprehension: {
      key_points_captured: Math.ceil(contentAccuracyPercentage / 20),
      score: contentAccuracyPercentage >= 60 ? 1 : 0.5,
    },
    spelling_grammar: {
      error_count: misspelledWords.length,
      error_percentage: Math.round(
        (misspelledWords.length / Math.max(1, userWords.length)) * 100
      ),
      score:
        misspelledWords.length <= Math.ceil(userWords.length * 0.1) ? 1 : 0.5,
    },
    completeness: {
      length_ratio: Math.min(1, userWords.length / transcriptWords.length),
      score: userWords.length >= transcriptWords.length * 0.8 ? 1 : 0.5,
    },
    overall_score: 0,
    percentage_score: 0,
  };

  metrics.overall_score =
    metrics.content_accuracy.score +
    metrics.attempt.score +
    metrics.comprehension.score +
    metrics.spelling_grammar.score +
    metrics.completeness.score;

  metrics.percentage_score = Math.round((metrics.overall_score / 10) * 100);

  return {
    metrics: metrics,
    totalScore: metrics.overall_score,
    percentageScore: metrics.percentage_score,
  };
};

export const generateDetailedFeedback = (metrics) => {
  const feedback = {
    summary: "",
    strengths: [],
    improvements: [],
  };

  const totalScore = metrics.overall_score;
  if (totalScore >= 8) {
    feedback.summary =
      "Excellent! Your transcription is highly accurate and complete.";
  } else if (totalScore >= 6) {
    feedback.summary =
      "Very good job! Your answer captures most of the audio content with good accuracy.";
  } else if (totalScore >= 4.5) {
    feedback.summary =
      "Good job! Your transcription shows understanding with some areas to improve.";
  } else if (totalScore >= 3) {
    feedback.summary =
      "You're making progress. Focus on capturing more words accurately.";
  } else {
    feedback.summary =
      "Keep practicing! Try to listen more carefully to capture the key information.";
  }

  if (metrics.content_accuracy.score >= 3) {
    feedback.strengths.push(
      "Good content accuracy - you captured most words correctly"
    );
  }

  if (metrics.comprehension.score >= 0.75) {
    feedback.strengths.push("Good comprehension of the main message");
  }

  if (metrics.spelling_grammar.score >= 0.75) {
    feedback.strengths.push("Few spelling errors in your response");
  }

  if (metrics.completeness.score >= 0.75) {
    feedback.strengths.push(
      "Complete transcription that captures most of the content"
    );
  }

  if (metrics.content_accuracy.score < 3) {
    feedback.improvements.push(
      "Work on word-for-word accuracy when transcribing"
    );
  }

  if (metrics.comprehension.score < 0.75) {
    feedback.improvements.push(
      "Focus on understanding the main points of the audio"
    );
  }

  if (metrics.spelling_grammar.score < 0.75) {
    feedback.improvements.push("Practice correct spelling for common words");
  }

  if (metrics.completeness.score < 0.75) {
    feedback.improvements.push(
      "Try to include all parts of the audio in your transcription"
    );
  }

  return feedback;
};

const levenshteinDistance = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}; 