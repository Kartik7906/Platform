import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import listeningExercises from "../../CoursePlatform/training/listeningExercises.json";
import ProgressBar from "../../CoursePlatform/common/ProgressBar";
import ScoreBreakdown from "../../CoursePlatform/common/ScoreBreakdown";
import AttemptHistory from "../../CoursePlatform/common/AttemptHistory";
import textToSpeechService from "../../services/TextToSpeechService";
import progressService from "../../services/progressService";
import { determineSkillType } from "../../CoursePlatform/utils/skillTypeUtils";
import ModuleAccessAlert from "../../CoursePlatform/common/ModuleAccessAlert";
import { calculateDetailedScore, generateDetailedFeedback } from "./ListeningUtils/scoreCalculationUtils";
import { processExercises, getCurrentExercise, calculateCompletionPercentage, isLevelCompleted, resetExerciseState } from "./ListeningUtils/exerciseUtils";
import { loadCompletedData, saveAttemptToHistory, finishLevel } from "./ListeningUtils/progressUtils";
import { handlePlayAudio } from "./ListeningUtils/audioUtils";
import { handleSubmit as handleSubmitValidation, validateExerciseSubmission } from "./ListeningUtils/validationUtils";
import "./ListeningTraining.css";

const ListeningTraining = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [exercises, setExercises] = useState([]);
  const [accessError, setAccessError] = useState(null);
  const [exercisesByLevel, setExercisesByLevel] = useState({});
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [showSampleAnswer, setShowSampleAnswer] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [detailedScore, setDetailedScore] = useState(null);
  const [levelScores, setLevelScores] = useState({});
  const [completedExercises, setCompletedExercises] = useState([]);
  const [completedLevels, setCompletedLevels] = useState([]);
  const [learningCompleted, setLearningCompleted] = useState(false);
  const [readingCompleted, setReadingCompleted] = useState(false);
  const [attemptHistory, setAttemptHistory] = useState([]);
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState(null);
  const [bestAttempt, setBestAttempt] = useState(null);
  const [maxPlaysReached, setMaxPlaysReached] = useState(false);
  const [levelCompleted, setLevelCompleted] = useState(false);
  const [levelResults, setLevelResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [exercisesLoaded, setExercisesLoaded] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [viewMode, setViewMode] = useState("levels");
  const [levelStarted, setLevelStarted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [timerActive, setTimerActive] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [questionStatus, setQuestionStatus] = useState({});

  const exerciseScoresRef = useRef([]);
  const userId = localStorage.getItem("userId");
  const skillType = determineSkillType(location.pathname);

  // Create a memoized version of getCurrentExercise
  const getCurrentExerciseMemo = () => getCurrentExercise(exercisesByLevel, selectedLevel, currentExerciseIndex);

  useEffect(() => {
    try {
      console.log("Initializing ListeningTraining component...");
      const { allExercises, levelGroups } = processExercises();
      setExercisesByLevel(levelGroups);
      setExercises(allExercises);
      setContentLoaded(true);
      setExercisesLoaded(true);
    } catch (err) {
      console.error("Error processing exercises data:", err);
      setError("Failed to process exercises data. Please try again.");
      setExercisesLoaded(true);
    }
  }, []);

  useEffect(() => {
    const checkPreviousCompletion = async () => {
      try {
        if (!userId) {
          setError("User not logged in");
          return;
        }

        console.log(`Checking previous completion for user ${userId}, skillType ${skillType}`);

        const completedTopicsFromStorage = JSON.parse(
          localStorage.getItem(`${skillType}_completed`) || "[]"
        );

        let learningTopics = [];
        if (skillType === "softskills") {
          learningTopics = [
            "parts-of-speech",
            "tenses",
            "sentence-correction",
            "communication",
          ];
        } else if (skillType === "sales") {
          learningTopics = [
            "introduction",
            "telecalling",
            "skills-needed",
            "telecalling-module",
          ];
        } else if (skillType === "product") {
          learningTopics = ["bank-terminologies", "casa-kyc", "personal-loans"];
        }

        const allCompletedInStorage = learningTopics.every((topic) =>
          completedTopicsFromStorage.includes(topic)
        );

        if (allCompletedInStorage) {
          setLearningCompleted(true);
          const userProgress = await progressService.getUserProgress(userId);
          const trainingProgress = userProgress.trainingProgress || {};

          let readingCompletionPercentage = 0;
          if (trainingProgress.reading) {
            if (Array.isArray(trainingProgress.reading)) {
              const readingAttempts = trainingProgress.reading || [];
              readingCompletionPercentage = (readingAttempts.length / 5) * 100;
            } else {
              const readingPassageIds = Object.keys(trainingProgress.reading);
              readingCompletionPercentage = (readingPassageIds.length / 5) * 100;
            }
          }

          const isReadingModuleCompleted = readingCompletionPercentage >= 50;
          setReadingCompleted(isReadingModuleCompleted);

          if (!isReadingModuleCompleted) {
            setAccessError({
              message: `You need to complete at least 50% of the Reading module before accessing Listening Training. (Current progress: ${Math.round(
                readingCompletionPercentage
              )}%)`,
              redirectPath: `/${skillType}/training/reading`,
            });
            setProgressLoaded(true);
            return;
          }

          await loadCompletedData(
            userId,
            setCompletedExercises,
            setCompletedLevels,
            setLevelScores,
            setAttemptHistory,
            setBestAttempt
          );
          setProgressLoaded(true);
          setLoading(false);
          return;
        }

        const userProgress = await progressService.getUserProgress(userId);
        const learningProgress = userProgress.learningProgress[skillType] || {};

        const allCompleted = learningTopics.every(
          (topic) => learningProgress[topic] && learningProgress[topic].completed
        );

        if (allCompleted) {
          localStorage.setItem(
            `${skillType}_completed`,
            JSON.stringify(learningTopics)
          );
        }

        setLearningCompleted(allCompleted);

        if (!allCompleted) {
          console.log("Not all learning topics completed, redirecting to learning page");
          navigate(`/${skillType}/learning/${learningTopics[0]}`);
          return;
        }

        const trainingProgress2 = userProgress.trainingProgress || {};
        let readingCompletionPercentage = 0;
        if (trainingProgress2.reading) {
          if (Array.isArray(trainingProgress2.reading)) {
            const readingAttempts = trainingProgress2.reading || [];
            readingCompletionPercentage = (readingAttempts.length / 5) * 100;
          } else {
            const readingPassageIds = Object.keys(trainingProgress2.reading);
            readingCompletionPercentage = (readingPassageIds.length / 5) * 100;
          }
        }

        const isReadingModuleCompleted2 = readingCompletionPercentage >= 50;
        setReadingCompleted(isReadingModuleCompleted2);

        if (!isReadingModuleCompleted2 && !location.pathname.includes("/training/listening")) {
          console.log("Reading module not completed, redirecting to reading page");
          navigate(`/${skillType}/training/reading`);
          return;
        }

        await loadCompletedData(
          userId,
          setCompletedExercises,
          setCompletedLevels,
          setLevelScores,
          setAttemptHistory,
          setBestAttempt
        );
        setProgressLoaded(true);
        setLoading(false);
      } catch (err) {
        console.error("Error checking completion:", err);
        setError("Failed to load progress data. Please try again.");
        setProgressLoaded(true);
        setLoading(false);
      }
    };

    if (contentLoaded) {
      checkPreviousCompletion();
      textToSpeechService.resetPlayCount();
    }

    return () => {
      textToSpeechService.cancel();
    };
  }, [contentLoaded, navigate, userId, skillType, location.pathname]);

  useEffect(() => {
    let timer;
    if (timerActive && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else if (timeRemaining === 0) {
      // Handle time up
      setTimerActive(false);
    }
    return () => clearInterval(timer);
  }, [timerActive, timeRemaining]);

  useEffect(() => {
    // Start timer when level starts
    if (levelStarted) {
      setTimerActive(true);
      setTimeRemaining(600);
    }
  }, [levelStarted]);

  useEffect(() => {
    // Update progress based on current exercise
    if (selectedLevel && exercisesByLevel[selectedLevel]) {
      const totalExercises = exercisesByLevel[selectedLevel].length;
      const progress = ((currentExerciseIndex + 1) / totalExercises) * 100;
      setCurrentProgress(progress);
    }
  }, [currentExerciseIndex, selectedLevel, exercisesByLevel]);

  useEffect(() => {
    // Update question status
    if (selectedLevel && exercisesByLevel[selectedLevel]) {
      const status = {};
      exercisesByLevel[selectedLevel].forEach((_, index) => {
        if (index < currentExerciseIndex) {
          status[index] = 'completed';
        } else if (index === currentExerciseIndex) {
          status[index] = 'active';
        } else {
          status[index] = 'unanswered';
        }
      });
      setQuestionStatus(status);
    }
  }, [currentExerciseIndex, selectedLevel, exercisesByLevel]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const selectLevel = (level) => {
    setSelectedLevel(level);
    setCurrentExerciseIndex(0);
    resetExerciseState(
      setUserAnswer,
      setShowSampleAnswer,
      setFeedback,
      setDetailedScore,
      setMaxPlaysReached,
      textToSpeechService
    );
    exerciseScoresRef.current = [];
    setLevelCompleted(false);
    setLevelResults(null);
    setViewMode("exercise");
    setLevelStarted(true);
  };

  const handleNextExercise = () => {
    const levelExs = exercisesByLevel[selectedLevel] || [];
    if (currentExerciseIndex < levelExs.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      resetExerciseState(
        setUserAnswer,
        setShowSampleAnswer,
        setFeedback,
        setDetailedScore,
        setMaxPlaysReached,
        textToSpeechService
      );
    } else {
      finishLevel(
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
      );
    }
  };

  const handleBackToLevels = () => {
    if (!levelStarted) {
      setViewMode("levels");
      if (levelCompleted) {
        resetExerciseState(
          setUserAnswer,
          setShowSampleAnswer,
          setFeedback,
          setDetailedScore,
          setMaxPlaysReached,
          textToSpeechService
        );
        setLevelCompleted(false);
        setLevelResults(null);
      }
    } else {
      setError("You must complete all exercises in this level before going back.");
    }
  };

  const handleSubmit = (e) => {
    handleSubmitValidation(
      e,
      getCurrentExerciseMemo,
      userAnswer,
      setError,
      setDetailedScore,
      setFeedback,
      setShowSampleAnswer,
      exerciseScoresRef,
      (exercise, scoreData) => saveAttemptToHistory(
        exercise,
        scoreData,
        userAnswer,
        userId,
        completedExercises,
        setCompletedExercises,
        setAttemptHistory,
        setBestAttempt,
        generateDetailedFeedback
      ),
      calculateDetailedScore,
      generateDetailedFeedback
    );
  };

  const handlePlay = () => {
    handlePlayAudio(
      getCurrentExerciseMemo,
      isPlaying,
      setIsPlaying,
      setMaxPlaysReached,
      setError,
      textToSpeechService
    );
  };

  const calculateCompletionPercentage = () => {
    const totalLevels = Object.keys(exercisesByLevel).length;
    return totalLevels > 0 ? (completedLevels.length / totalLevels) * 100 : 0;
  };

  const EnhancedAttemptHistory = () => {
    if (attemptHistory.length === 0) return null;

    const limitedAttempts = attemptHistory.slice(0, 3);

    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };

    const handleAttemptSelect = (index) => {
      setSelectedAttemptIndex(index);
      const selectedAttempt = limitedAttempts[index];
      const compatibleScoreData = {
        metrics: selectedAttempt,
        totalScore: selectedAttempt.overall_score,
        percentageScore: selectedAttempt.percentage_score,
        feedback: selectedAttempt.feedback,
      };
      setDetailedScore(compatibleScoreData);
      setAccuracy(selectedAttempt.percentage_score);
      setFeedback(selectedAttempt.feedback?.summary || "");
      setUserAnswer(selectedAttempt.transcript || "");
    };
  };

  const EnhancedScoreBreakdown = ({ scoreData }) => {
    if (!scoreData || !scoreData.metrics) return null;

    const { metrics } = scoreData;

    const getScoreColor = (score, max) => {
      const ratio = score / max;
      if (ratio >= 0.8) return "#4caf50";
      if (ratio >= 0.5) return "#ff9800";
      return "#f44336";
    };

    return (
      <div className="enhanced-score-breakdown">
        <div className="score-header">
          <h3>Score Breakdown</h3>
          <div className="total-score">
            <div className="score-circle">
              <span className="score-number">
                {Math.round(metrics.overall_score)}
              </span>
              <span className="score-max">/10</span>
            </div>
            <div className="score-percentage">{metrics.percentage_score}%</div>
          </div>
        </div>

        <div className="new-score-categories">
          {/* Content Accuracy - 5 points */}
          <div className="score-category">
            <div className="category-header">
              <h4>Content Accuracy</h4>
              <div className="category-score">
                {metrics.content_accuracy?.score || 0}/5
              </div>
            </div>
            <div className="score-bar-container">
              <div
                className="score-bar"
                style={{
                  width: `${(metrics.content_accuracy?.score / 5) * 100}%`,
                  backgroundColor: getScoreColor(
                    metrics.content_accuracy?.score || 0,
                    5
                  ),
                }}
              ></div>
            </div>
            <div className="category-details">
              <div className="detail-item">
                <span className="detail-label">Correct words:</span>
                <span className="detail-value">
                  {metrics.content_accuracy?.correct_words || 0} of{" "}
                  {metrics.content_accuracy?.total_words || 0}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Accuracy:</span>
                <span className="detail-value">
                  {metrics.content_accuracy?.accuracy_percentage || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Attempt - 1 point */}
          <div className="score-category">
            <div className="category-header">
              <h4>Attempt</h4>
              <div className="category-score">
                {metrics.attempt?.score || 0}/1
              </div>
            </div>
            <div className="score-bar-container">
              <div
                className="score-bar"
                style={{
                  width: `${(metrics.attempt?.score / 1) * 100}%`,
                  backgroundColor: getScoreColor(
                    metrics.attempt?.score || 0,
                    1
                  ),
                }}
              ></div>
            </div>
            <div className="category-details">
              <div className="detail-item success">
                <span className="detail-check">✓</span> Attempt completed
              </div>
            </div>
          </div>

          {/* Comprehension - 1 point */}
          <div className="score-category">
            <div className="category-header">
              <h4>Comprehension</h4>
              <div className="category-score">
                {metrics.comprehension?.score || 0}/1
              </div>
            </div>
            <div className="score-bar-container">
              <div
                className="score-bar"
                style={{
                  width: `${(metrics.comprehension?.score / 1) * 100}%`,
                  backgroundColor: getScoreColor(
                    metrics.comprehension?.score || 0,
                    1
                  ),
                }}
              ></div>
            </div>
            <div className="category-details">
              <div className="detail-item">
                <span className="detail-label">Key points captured:</span>
                <span className="detail-value">
                  {metrics.comprehension?.key_points_captured || 0}/5
                </span>
              </div>
            </div>
          </div>

          {/* Spelling & Grammar - 1 point */}
          <div className="score-category">
            <div className="category-header">
              <h4>Spelling & Grammar</h4>
              <div className="category-score">
                {metrics.spelling_grammar?.score || 0}/1
              </div>
            </div>
            <div className="score-bar-container">
              <div
                className="score-bar"
                style={{
                  width: `${(metrics.spelling_grammar?.score / 1) * 100}%`,
                  backgroundColor: getScoreColor(
                    metrics.spelling_grammar?.score || 0,
                    1
                  ),
                }}
              ></div>
            </div>
            <div className="category-details">
              <div className="detail-item">
                <span className="detail-label">Spelling errors:</span>
                <span className="detail-value">
                  {metrics.spelling_grammar?.error_count || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Completeness - 1 point */}
          <div className="score-category">
            <div className="category-header">
              <h4>Completeness</h4>
              <div className="category-score">
                {metrics.completeness?.score || 0}/1
              </div>
            </div>
            <div className="score-bar-container">
              <div
                className="score-bar"
                style={{
                  width: `${(metrics.completeness?.score / 1) * 100}%`,
                  backgroundColor: getScoreColor(
                    metrics.completeness?.score || 0,
                    1
                  ),
                }}
              ></div>
            </div>
            <div className="category-details">
              <div className="detail-item">
                <span className="detail-label">Length ratio:</span>
                <span className="detail-value">
                  {Math.round((metrics.completeness?.length_ratio || 0) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Section */}
        {metrics.feedback && (
          <div className="enhanced-feedback-section">
            <h4>Feedback</h4>
            <p className="feedback-summary">{metrics.feedback.summary}</p>

            {metrics.feedback.strengths?.length > 0 && (
              <div className="feedback-strengths">
                <h5>Strengths:</h5>
                <ul>
                  {metrics.feedback.strengths.map((strength, index) => (
                    <li key={`strength-${index}`}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}

            {metrics.feedback.improvements?.length > 0 && (
              <div className="feedback-improvements">
                <h5>Areas for Improvement:</h5>
                <ul>
                  {metrics.feedback.improvements.map((improvement, index) => (
                    <li key={`improvement-${index}`}>{improvement}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="listening-container">
      {accessError && (
        <ModuleAccessAlert
          message={accessError.message}
          redirectPath={accessError.redirectPath}
          onClose={() => setAccessError(null)}
        />
      )}
      {(!exercisesLoaded) && (
        <div className="listening-loading">
          <div className="listening-spinner"></div>
          <p>Loading listening exercises...</p>
        </div>
      )}
      {error && (
        <div className="listening-error">
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            className="listening-clear-error"
          >
            Dismiss
          </button>
        </div>
      )}
      {exercisesLoaded && (
        <>
          <div className="listening-header">
            <div className="ListeningSection-infoSection">
              <h1>Listening & Writing Training</h1>
              <p>
                Improve your listening skills by practicing with these audio
                exercises.
              </p>
              <p>You are allowed up to three attempts per passage.</p>
              <p>
                Consistent practice will help you earn higher rankings and
                achieve mastery.
              </p>
            </div>
            <div className="listening-progress">
              <h3>
                Module Progress 
                ({Math.round(calculateCompletionPercentage())}%)
              </h3>
              <ProgressBar percentage={calculateCompletionPercentage()} />

              {completedExercises.length >= Math.ceil(Object.keys(exercisesByLevel).length * 0.5) ? (
                <div className="listening-progress-message success">
                  <span className="listening-checkmark">✓</span>
                  Congratulations! You have completed the Listening module!
                </div>
              ) : (
                <div className="listening-progress-message">
                  Complete{" "}
                  {Math.ceil(Object.keys(exercisesByLevel).length * 0.5) -
                    completedLevels.length}{" "}
                  more level(s) to complete this module.
                </div>
              )}
            </div>
          </div>

          {viewMode === "levels" && (
            <div className="listening-level-selection">
              <h2>Select a Difficulty Level</h2>
              <div className="listening-instructions">
                <p>Choose a level to start practicing.</p>
              </div>
              <div className="listening-level-grid">
                {Object.keys(exercisesByLevel).map((level) => (
                  <div
                    key={level}
                    className={`listening-level-card ${
                      isLevelCompleted(level, completedLevels) ? "completed" : ""
                    }`}
                    onClick={() => selectLevel(level)}
                  >
                    <h3>
                      Level: {level}
                      {isLevelCompleted(level, completedLevels) && (
                        <span className="listening-card-checkmark">✓</span>
                      )}
                    </h3>
                    <div className="listening-level-card-content">
                      <p>
                        {exercisesByLevel[level].length} exercises
                        {levelScores[level] &&
                          ` • Score: ${levelScores[level]}%`}
                      </p>
                    </div>
                    <div className="listening-card-footer">
                      <span className="listening-difficulty-level">
                        {level}
                      </span>
                      {isLevelCompleted(level, completedLevels) && (
                        <span className="listening-card-completed">
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === "exercise" && !levelCompleted && (
            <div className="exercise-container">
              <div className="exercise-header">
                <h2>Level {selectedLevel} - Listening Exercise</h2>
                <button 
                  className="back-button" 
                  onClick={handleBackToLevels}
                  disabled={levelStarted}
                >
                  ← Back to Levels
                </button>
              </div>

              <div className="exam-layout">
                <div className="exam-content">
                  {getCurrentExerciseMemo() ? (
                    <>
                      <div className="instructions-box">
                        <h4>Instructions</h4>
                        <p>
                          Listen to the audio carefully and type what you hear in the space provided below.
                          You can play the audio up to 3 times. Make sure to type your answer accurately.
                        </p>
                      </div>

                      <div className="exercise-title">
                        <h3>
                          Exercise {currentExerciseIndex + 1} of{" "}
                          {(exercisesByLevel[selectedLevel] || []).length}
                        </h3>
                      </div>

                      <div className="audio-player">
                        <button
                          className={`play-button ${isPlaying ? "playing" : ""}`}
                          onClick={handlePlay}
                          disabled={maxPlaysReached}
                        >
                          <span className="play-icon">
                            {isPlaying ? "⏸️" : "▶️"}
                          </span>
                          {isPlaying ? "Pause Audio" : "Play Audio"}
                        </button>

                        {maxPlaysReached && (
                          <div className="max-plays-message">
                            <span className="info-icon">ℹ️</span>
                            Maximum plays reached. Please submit your answer.
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleSubmit} className="answer-form">
                        <div className="form-group">
                          <label htmlFor="userAnswer">Your Answer:</label>
                          <textarea
                            id="userAnswer"
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            placeholder="Type your answer here..."
                            className="answer-textarea"
                          ></textarea>
                          <div className="word-count">
                            Words: {userAnswer.trim() ? userAnswer.trim().split(/\s+/).length : 0}
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="submit-button"
                          disabled={!userAnswer.trim()}
                        >
                          Submit Answer
                        </button>
                      </form>

                      {feedback && (
                        <div className="feedback-container">
                          <h3>Results</h3>
                          <div className="score-display">
                            <h4>
                              Score:{" "}
                              {detailedScore
                                ? detailedScore.metrics.percentage_score
                                : 0}
                              %
                            </h4>
                            <div className="accuracy-meter">
                              <div
                                className="accuracy-bar"
                                style={{
                                  width: `${
                                    detailedScore
                                      ? detailedScore.metrics.percentage_score
                                      : 0
                                  }%`,
                                  backgroundColor:
                                    detailedScore &&
                                    detailedScore.metrics.percentage_score >= 80
                                      ? "#4caf50"
                                      : detailedScore &&
                                        detailedScore.metrics.percentage_score >= 60
                                      ? "#ff9800"
                                      : "#f44336",
                                }}
                              ></div>
                            </div>
                          </div>

                          {showSampleAnswer && (
                            <div className="sample-answer">
                              <h3>Correct Answer</h3>
                              <p>{getCurrentExerciseMemo().transcript}</p>
                            </div>
                          )}

                          {detailedScore && (
                            <EnhancedScoreBreakdown scoreData={detailedScore} />
                          )}

                          <button
                            onClick={handleNextExercise}
                            className="next-button"
                          >
                            {currentExerciseIndex <
                            (exercisesByLevel[selectedLevel] || []).length - 1
                              ? "Next Exercise"
                              : "Finish Level"}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="error-message">
                      Exercise not found. Please select another level.
                    </div>
                  )}
                </div>

                <div className="exam-sidebar">
                  <div className="exam-info">
                    <div className="exam-timer">
                      <span className="timer-icon">⏱️</span>
                      <span>Time Remaining: {formatTime(timeRemaining)}</span>
                    </div>
                    <div className="exam-progress">
                      <span className="progress-icon">📊</span>
                      <span>Progress: {Math.round(currentProgress)}%</span>
                    </div>
                  </div>

                  <div className="question-palette">
                    <h3>Question Palette</h3>
                    <div className="question-grid">
                      {(exercisesByLevel[selectedLevel] || []).map((exercise, index) => (
                        <div
                          key={index}
                          className={`question-number ${questionStatus[index] || 'unanswered'}`}
                          onClick={() => {
                            if (questionStatus[index] === 'completed') {
                              setCurrentExerciseIndex(index);
                            }
                          }}
                        >
                          {index + 1}
                          {questionStatus[index] === 'completed' && (
                            <span className="question-status">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="exam-legend">
                    <h3>Legend</h3>
                    <div className="legend-items">
                      <div className="legend-item">
                        <div className="legend-color active"></div>
                        <span>Current Question ({currentExerciseIndex + 1})</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-color completed"></div>
                        <span>Completed ({Object.values(questionStatus).filter(status => status === 'completed').length})</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-color unanswered"></div>
                        <span>Unanswered ({Object.values(questionStatus).filter(status => status === 'unanswered').length})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ListeningTraining;
