import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import speakingTopics from '../training/speakingTopics.json';
import ProgressBar from '../common/ProgressBar';
import ScoreBreakdown from '../common/ScoreBreakdown';
import progressService from '../../services/progressService';
import { determineSkillType } from '../utils/skillTypeUtils';
import './SpeakingTraining.css';
import ModuleAccessAlert from '../common/ModuleAccessAlert';

const SpeakingTraining = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [topics, setTopics] = useState([]);
  const [accessError, setAccessError] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [completedTopics, setCompletedTopics] = useState([]);
  const [learningCompleted, setLearningCompleted] = useState(false);
  const [previousModulesCompleted, setPreviousModulesCompleted] = useState(false);
  // const [loading, setLoading] = useState(true);
  const [topicsLoaded, setTopicsLoaded] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [detailedScore, setDetailedScore] = useState(null);
  const [attemptHistory, setAttemptHistory] = useState([]);
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState(null);
  const [bestAttempt, setBestAttempt] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  
  // Use consistent skill type detection
  const skillType = determineSkillType(location.pathname);
  const userId = localStorage.getItem('userId');
  
  // References for timers and speech recognition
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');

  // Pre-process topics on component mount
  useEffect(() => {
    try {
      console.log('Initializing SpeakingTraining component...');
      
      // Safely check if speakingTopics is available and valid
      if (!speakingTopics || !Array.isArray(speakingTopics)) {
        console.error('Error: speakingTopics is not a valid array', speakingTopics);
        setError('Failed to load speaking topics data. Please try again.');
        setTopicsLoaded(true);
        return;
      }
      
      console.log(`Processing ${speakingTopics.length} speaking topics`);
      
      // Process topics and add any necessary properties
      const processedTopics = speakingTopics.map(topic => ({
        ...topic,
        // Default values for any missing properties
        level: topic.level || 'Beginner',
        timeLimit: topic.timeLimit || 120, // 2 minutes default
        tips: topic.tips || [],
        keyPoints: topic.keyPoints || []
      }));
      
      setTopics(processedTopics);
      setTopicsLoaded(true);
    } catch (err) {
      console.error('Error processing topics data:', err);
      setError('Failed to process topics data. Please try again.');
      setTopicsLoaded(true);
    }
  }, []);
// Simplified Gemini service that only checks for topic relevance
const createGeminiService = () => {
  // Your API key
  const apiKey = 'AIzaSyAeKDFy9EGSQ5m9OlIjP33adzG1ZF-O-xg';
  
  // API endpoint
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
  
  /**
   * Checks if a speaking response is relevant to the given topic
   * @param {string} topic - The topic title
   * @param {string} prompt - The speaking prompt
   * @param {string} userTranscript - The user's spoken response transcript
   * @returns {Promise<Object>} - Simple object with relevance information
   */
  const analyzeSpeakingResponse = async (topic, prompt, userTranscript) => {
    // Simplified request that only asks about topic relevance
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: `Evaluate if the following response is relevant to the given topic and prompt:
                
                Topic: "${topic}"
                Prompt: "${prompt}"
                
                User's Transcript:
                "${userTranscript}"
                
                Please provide:
                1. Is the response on-topic and relevant to the given topic? Answer with YES or NO.
                2. A brief explanation of why the response is or isn't relevant (1-2 sentences).
                
                Format your response as JSON with the following fields:
                - isRelevant (boolean)
                - explanation (string)
                
                Keep the explanation under 100 words.`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 200
      }
    };
    
    return callGeminiAPI(requestBody);
  };
  
  /**
   * Makes the API call to Gemini
   */
  const callGeminiAPI = async (requestBody) => {
    try {
      // Build URL with API key
      const url = `${baseUrl}?key=${apiKey}`;
      console.log('Calling Gemini API...');
      
      // Make the fetch request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      // Handle non-successful responses
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gemini API error (${response.status}):`, errorText);
        console.warn('Using mock response instead.');
        return getMockResponse(true);
      }
      
      // Parse the successful response
      const data = await response.json();
      console.log('Received API response successfully');
      
      // Extract text from response based on the Gemini API structure
      let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Clean up JSON from markdown formatting if present
      let cleanedText = responseText;
      
      // Check if response is wrapped in markdown code blocks
      const jsonBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonBlockMatch && jsonBlockMatch[1]) {
        cleanedText = jsonBlockMatch[1].trim();
        console.log('Extracted JSON from markdown code block');
      }
      
      // Parse the text as JSON
      try {
        const parsedJson = JSON.parse(cleanedText);
        console.log('Successfully parsed JSON response');
        return parsedJson;
      } catch (error) {
        console.error('Error parsing Gemini response as JSON:', error);
        console.log('Raw response was:', responseText);
        
        // Simple fallback - check if response contains YES/NO
        const isRelevant = responseText.toLowerCase().includes('yes') && 
                           !responseText.toLowerCase().includes('no');
        
        return {
          isRelevant: isRelevant,
          explanation: "Unable to parse full response, but analysis suggests the content is " + 
                       (isRelevant ? "on-topic." : "off-topic.")
        };
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      return getMockResponse(true); // Default to on-topic if API fails completely
    }
  };
  
  /**
   * Provides a mock response when API fails
   * @param {boolean} relevant - Whether to return an on-topic or off-topic response
   */
  const getMockResponse = (relevant = true) => {
    return {
      isRelevant: relevant,
      explanation: relevant ? 
        "The response directly addresses the topic and covers relevant aspects mentioned in the prompt." :
        "The response doesn't address the main points of the topic and appears to discuss unrelated subjects."
    };
  };
  
  return {
    analyzeSpeakingResponse
  };
};

// Create a singleton instance
const geminiService = createGeminiService();
  

  // Get learning topics based on skill type
  const getLearningTopics = useCallback(() => {
    if (skillType === 'sales') {
      return ['introduction', 'telecalling', 'skills-needed', 'telecalling-module'];
    } else if (skillType === 'product') {
      return ['bank-terminologies', 'casa-kyc', 'personal-loans'];
    } else {
      // Default to softskills
      return ['parts-of-speech', 'tenses', 'sentence-correction', 'communication'];
    }
  }, [skillType]);

  // Check previous completion and dependencies
  useEffect(() => {

    if (!topicsLoaded) return;

    const checkPreviousCompletion = async () => {
      try {
        // setLoading(true);
        
        if (!userId) {
          setError('User not logged in');
          navigate('/login');
          return;
        }
        
        console.log(`Checking previous completion for user ${userId}, skillType ${skillType}`);
        
        // Declare these variables at the function level, not inside the if block
        let readingCompletionPercentage = 0;
        let listeningCompletionPercentage = 0;
        
        // First, check localStorage for completion status (faster)
        const completedTopicsFromStorage = JSON.parse(
          localStorage.getItem(`${skillType}_completed`) || '[]'
        );
        
        // Get the appropriate learning topics for this skill type
        const learningTopics = getLearningTopics();
        
        // Check if all required topics are completed in localStorage
        const allCompletedInStorage = learningTopics.every(topic => 
          completedTopicsFromStorage.includes(topic)
        );
        
        console.log(`Learning completion status from localStorage: ${allCompletedInStorage}`);
        
        let allLearningCompleted = allCompletedInStorage;
        let areModulesCompleted = true;
        
        // If not found in localStorage, check the server
        if (!allCompletedInStorage) {
          const userProgress = await progressService.getUserProgress(userId);
          const learningProgress = userProgress.learningProgress[skillType] || {};
          
          // Check if all topics are completed in the database
          allLearningCompleted = learningTopics.every(topic => 
            learningProgress[topic] && learningProgress[topic].completed
          );
          
          console.log(`All ${skillType} learning topics completed? ${allLearningCompleted}`);
          
          // Store in localStorage for future checks
          if (allLearningCompleted) {
            localStorage.setItem(`${skillType}_completed`, JSON.stringify(learningTopics));
          }
        }
        
        // For softskills, check previous training modules completion
        if (skillType === 'softskills') {
          const userProgress = await progressService.getUserProgress(userId);
          const trainingProgress = userProgress.trainingProgress || {};
          
          // Handle both old and new data structures
          if (trainingProgress.reading) {
            if (Array.isArray(trainingProgress.reading)) {
              // Old structure
              const readingAttempts = trainingProgress.reading || [];
              readingCompletionPercentage = (readingAttempts.length / 5) * 100;
            } else {
              // New structure
              const readingPassageIds = Object.keys(trainingProgress.reading);
              readingCompletionPercentage = (readingPassageIds.length / 5) * 100;
            }
          }
          
          if (trainingProgress.listening) {
            if (Array.isArray(trainingProgress.listening)) {
              // Old structure
              const listeningAttempts = trainingProgress.listening || [];
              listeningCompletionPercentage = (listeningAttempts.length / 5) * 100;
            } else {
              // New structure
              const listeningExerciseIds = Object.keys(trainingProgress.listening);
              listeningCompletionPercentage = (listeningExerciseIds.length / 5) * 100;
            }
          }
          
          areModulesCompleted = readingCompletionPercentage >= 50 && listeningCompletionPercentage >= 50;
          
          console.log('Previous modules status:', {
            readingCompletion: readingCompletionPercentage,
            listeningCompletion: listeningCompletionPercentage,
            areModulesCompleted
          });
        }
        
        setLearningCompleted(allLearningCompleted);
        setPreviousModulesCompleted(areModulesCompleted);
        
        // Redirect if prerequisites are not met
        if (!allLearningCompleted) {
          setAccessError({
            message: "You need to complete the Learning section first",
            redirectPath: `/${skillType}/learning/${learningTopics[0]}`
          });
          setProgressLoaded(true);
          return;
        } 
        
        // Check if both reading and listening are completed to required threshold
        if (!areModulesCompleted) {
          // Determine which module is not completed
          if (readingCompletionPercentage < 50) {
            setAccessError({
              message: `You need to complete at least 50% of the Reading module first. (Current progress: ${Math.round(readingCompletionPercentage)}%)`,
              redirectPath: `/${skillType}/training/reading`
            });
          } else {
            setAccessError({
              message: `You need to complete at least 50% of the Listening module first. (Current progress: ${Math.round(listeningCompletionPercentage)}%)`,
              redirectPath: `/${skillType}/training/listening`
            });
          }
          setProgressLoaded(true);
          return;
        }
        
        await loadCompletedTopics();
        await loadAttemptHistory();
        setProgressLoaded(true);
      } catch (err) {
        console.error('Error checking completion:', err);
        setError('Failed to load progress data. Please try again.');
        setProgressLoaded(true);
      }
    };

    // Initialize Web Speech API
    const initSpeechRecognition = () => {
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';
        
        recognitionRef.current.onresult = (event) => {
          let interimTranscript = '';
          let finalTranscriptSegment = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscriptSegment += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          if (finalTranscriptSegment) {
            finalTranscriptRef.current += ' ' + finalTranscriptSegment;
            setTranscript(finalTranscriptRef.current.trim());
          } else if (interimTranscript) {
            setTranscript(finalTranscriptRef.current + ' ' + interimTranscript);
          }
        };
        
        recognitionRef.current.onend = () => {
          if (isRecording) {
            // Try to restart if still recording
            setTimeout(() => {
              try {
                if (isRecording) {
                  recognitionRef.current.start();
                }
              } catch (error) {
                console.error('Error restarting recognition:', error);
              }
            }, 200);
          }
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          if (event.error !== 'no-speech') {
            stopRecording();
          }
        };
      } else {
        setError('Speech recognition is not supported in your browser. Please try Chrome or Edge.');
      }
    };

    
      checkPreviousCompletion();
      initSpeechRecognition();
    
    
    return () => {
      cleanupResources();
    };
  }, [topicsLoaded, navigate, userId, skillType, getLearningTopics]);

  // Cleanup function to prevent memory leaks
  const cleanupResources = () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Recognition already stopped');
      }
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Updated to work with new data structure
  const loadCompletedTopics = async () => {
    try {
      if (!userId) return;
      
      console.log(`Loading completed topics for user ${userId}, skillType ${skillType}`);
      
      const userProgress = await progressService.getUserProgress(userId);
      const trainingProgress = userProgress.trainingProgress || {};
      
      let completed = [];
      
      // Check if speaking data is in new structure
      if (trainingProgress.speaking) {
        if (typeof trainingProgress.speaking === 'object' && !Array.isArray(trainingProgress.speaking)) {
          // New structure - object with topic IDs as keys
          completed = Object.keys(trainingProgress.speaking);
        } else {
          // Old structure - array of attempts
          const speakingAttempts = trainingProgress.speaking || [];
          completed = speakingAttempts.map(result => result.topicId)
            .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        }
      }
      
      console.log(`Found ${completed.length} completed speaking topics:`, completed);
      
      // Ensure the state is updated with the data from the database
      setCompletedTopics(completed);
    } catch (error) {
      console.error('Error loading completed topics:', error);
      setError('Failed to load completed topics. Please try again.');
    }
  };

  // Updated to work with new data structure
  const loadAttemptHistory = async () => {
    try {
      if (!userId) return;
      
      console.log(`Loading speaking attempt history for user ${userId}`);
      
      const userProgress = await progressService.getUserProgress(userId);
      const trainingProgress = userProgress.trainingProgress || {};
      
      let allAttempts = [];
      
      // Check if speaking data is in new structure
      if (trainingProgress.speaking) {
        if (typeof trainingProgress.speaking === 'object' && !Array.isArray(trainingProgress.speaking)) {
          // New structure - object with topic IDs as keys
          let bestScore = 0;
          let bestAttemptData = null;
          
          Object.values(trainingProgress.speaking).forEach(topic => {
            if (topic.metrics && Array.isArray(topic.metrics)) {
              topic.metrics.forEach(metric => {
                const attemptData = {
                  ...metric,
                  topicId: topic.id,
                  title: topic.title,
                  date: metric.timestamp,
                  score: metric.percentage_score
                };
                
                allAttempts.push(attemptData);
                
                // Track best attempt
                if (metric.percentage_score > bestScore) {
                  bestScore = metric.percentage_score;
                  bestAttemptData = attemptData;
                }
              });
            }
          });
          
          // Sort by timestamp (newest first)
          allAttempts.sort((a, b) => 
            new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date)
          );
          
          if (bestAttemptData) {
            setBestAttempt(bestAttemptData);
          }
        } else {
          // Old structure - array of attempts
          const speakingAttempts = trainingProgress.speaking || [];
          allAttempts = speakingAttempts;
          
          // Find best attempt
          if (speakingAttempts.length > 0) {
            const bestAttempt = speakingAttempts.reduce((best, current) => 
              (current.score > best.score) ? current : best
            );
            setBestAttempt(bestAttempt);
          }
        }
      }
      
      setAttemptHistory(allAttempts);
    } catch (error) {
      console.error('Error loading attempt history:', error);
    }
  };

  const calculateCompletionPercentage = () => {
    if (!topics.length) return 0;
    return (completedTopics.length / topics.length) * 100;
  };

  const isTopicCompleted = (topicId) => {
    // Convert both to strings for comparison to handle type mismatches
    const topicIdStr = String(topicId);
    return completedTopics.some(id => String(id) === topicIdStr);
  };

  const selectTopic = (topic) => {
    setSelectedTopic(topic);
    setTranscript('');
    setIsPreparing(false);
    setIsRecording(false);
    setTimeLeft(0);
    setFeedback(null);
    setDetailedScore(null);
    setSelectedAttemptIndex(null);
  };

  const startPreparation = () => {
    if (!selectedTopic) {
      setError('No topic selected. Please select a topic and try again.');
      return;
    }
    
    setIsPreparing(true);
    setTimeLeft(30); // 30 seconds preparation time
    
    timerRef.current = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current);
          startRecording();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const startRecording = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not available. Please try a different browser.');
      return;
    }

    if (isPreparing) {
      setIsPreparing(false);
      clearInterval(timerRef.current);
    }
    
    setTranscript('');
    finalTranscriptRef.current = '';
    setIsRecording(true);
    setRecordingStartTime(Date.now());
    
    // Set the timer based on the topic's time limit (or default to 2 minutes)
    const timeLimit = selectedTopic ? (selectedTopic.timeLimit || 120) : 120;
    setTimeLeft(timeLimit);
    
    // Ensure recognition is not running already
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.log('Recognition was not running, starting fresh.');
    }
    
    // Start speech recognition after a small delay
    setTimeout(() => {
      try {
        recognitionRef.current.start();
        
        // Start the countdown timer
        timerRef.current = setInterval(() => {
          setTimeLeft(prevTime => {
            if (prevTime <= 1) {
              clearInterval(timerRef.current);
              stopRecording(); // Auto-submit when time runs out
              return 0;
            }
            return prevTime - 1;
          });
        }, 1000);
      } catch (error) {
        console.error('Error starting recognition:', error);
        setError('Error starting speech recognition. Please try again.');
        setIsRecording(false);
      }
    }, 300);
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log('Recognition already stopped');
      }
      
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (selectedTopic && transcript) {
        analyzeResponse();
      }
    }
  };

  const analyzeResponse = async () => {
    if (!selectedTopic || !transcript.trim()) {
      setError('No response recorded. Please try again.');
      return;
    }
    
    try {
      // Get recording duration in seconds
      const recordingDuration = (Date.now() - recordingStartTime) / 1000;
      
      // Analysis logic for the speaking response
      const words = transcript.split(/\s+/).filter(w => w.trim().length > 0);
      const wordCount = words.length;
      
      // First, check relevance using Gemini API before doing other calculations
      try {
        const geminiResponse = await geminiService.analyzeSpeakingResponse(
          selectedTopic.title,
          selectedTopic.prompt,
          transcript
        );
        
        // If the response is off-topic, handle it differently
        if (geminiResponse && !geminiResponse.isRelevant) {
          // Create simple off-topic feedback without calculating a score
          setFeedback({
            offTopic: true,
            text: "Your response appears to be off-topic. Please try again and make sure to address the selected topic.",
            explanation: geminiResponse.explanation || "Your response doesn't address the key aspects of the topic.",
          });
          
          // Don't save off-topic attempts to the database
          return; // Exit early - no scoring, no saving to DB
        }
      } catch (error) {
        console.error('Error checking topic relevance with Gemini:', error);
        // Continue with normal analysis if Gemini check fails
      }
      
      // Initialize metrics structure with new 9-point system
      const metrics = {
        // Speaking duration (5 points)
        speaking_duration: {
          duration_seconds: recordingDuration,
          minimum_required: 30, // 30 seconds minimum
          score: 0 // Will be set to 5 if spoke for minimum 30 seconds
        },
        
        // Attempt participation (1 point)
        attempt: {
          made: true,
          score: 1 // Always 1 for attempting
        },
        
        // Pronunciation quality (1 point)
        pronunciation: {
          mispronounced_words: [],
          mispronunciation_count: 0,
          score: 0 // Will be calculated
        },
        
        // Sentence framing (1 point)
        sentence_framing: {
          quality_score: 0,
          score: 0 // Will be calculated
        },
        
        // Punctuation usage (1 point)
        punctuation: {
          punctuation_count: 0,
          expected_count: 0,
          score: 0 // Will be calculated
        },
        
        // Relevance and key points (for feedback)
        relevance: {
          keyPointsCovered: 0,
          totalKeyPoints: selectedTopic.keyPoints.length,
          isTopicRelevant: true, // We already confirmed it's relevant if we got this far
          aiGeneratedFeedback: "" // Will store explanation from Gemini
        },
        
        // Overall score (out of 9)
        overall_score: 0,
        percentage_score: 0,
        offTopic: false // Not off-topic since we already checked
      };
      
      // 1. Score speaking duration (5 points)
      if (recordingDuration >= 30) {
        metrics.speaking_duration.score = 5;
      } else {
        // Partial credit for shorter durations
        metrics.speaking_duration.score = Math.round((recordingDuration / 30) * 5);
      }
      
      // 2. Attempt is already scored (1 point)
      
      // 3. Score pronunciation (1 point)
      // Simplified analysis - count complex words pronounced correctly
      const complexWords = words.filter(word => word.length > 6);
      const pronunciationScore = Math.min(1, complexWords.length / 5);
      metrics.pronunciation.score = pronunciationScore;
      
      // 4. Score sentence framing (1 point)
      // Look for complete sentences with subject-verb structure
      const sentenceCount = (transcript.match(/[.!?]+/g) || []).length;
      const estimatedSentenceCount = Math.max(1, Math.floor(wordCount / 8)); // Estimate 8 words per sentence
      
      const sentenceFramingScore = sentenceCount > 0 ? 
        Math.min(1, sentenceCount / estimatedSentenceCount) : 0.5;
      
      metrics.sentence_framing.quality_score = sentenceCount;
      metrics.sentence_framing.score = sentenceFramingScore;
      
      // 5. Score punctuation (1 point)
      const punctuationCount = (transcript.match(/[.!?,;:]+/g) || []).length;
      const expectedPunctuationCount = Math.max(1, Math.floor(wordCount / 10)); // Expect punctuation every ~10 words
      
      const punctuationScore = punctuationCount > 0 ? 
        Math.min(1, punctuationCount / expectedPunctuationCount) : 0;
      
      metrics.punctuation.punctuation_count = punctuationCount;
      metrics.punctuation.expected_count = expectedPunctuationCount;
      metrics.punctuation.score = punctuationScore;
      
      // Calculate key points covered for feedback
      const keyPointsCovered = selectedTopic.keyPoints.filter(point => {
        const keywords = point.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        return keywords.some(keyword => transcript.toLowerCase().includes(keyword));
      }).length;
      
      metrics.relevance.keyPointsCovered = keyPointsCovered;
      
      // Calculate overall score using our built-in metrics
      metrics.overall_score = 
        metrics.speaking_duration.score + 
        metrics.attempt.score + 
        metrics.pronunciation.score + 
        metrics.sentence_framing.score + 
        metrics.punctuation.score;
      
      // Ensure overall score is capped at 9
      metrics.overall_score = Math.min(9, metrics.overall_score);
      
      // Convert to percentage (100-point scale)
      metrics.percentage_score = Math.round((metrics.overall_score / 10) * 100);
      
      // Generate feedback based on metrics
      const feedback = generateDetailedFeedback(metrics);
      
      // Create detailed score object for ScoreBreakdown component
      const scoreData = {
        totalScore: metrics.overall_score,
        percentageScore: metrics.percentage_score,
        metrics: {
          // For compatibility with ScoreBreakdown component
          wordCount,
          keyPointsCovered: metrics.relevance.keyPointsCovered,
          totalKeyPoints: selectedTopic.keyPoints.length,
          // New metrics
          speaking_duration: metrics.speaking_duration,
          attempt: metrics.attempt,
          pronunciation: metrics.pronunciation,
          sentence_framing: metrics.sentence_framing,
          punctuation: metrics.punctuation,
          // Relevance info
          relevance: metrics.relevance
        },
        feedback
      };
      
      setDetailedScore(scoreData);
      
      // Feedback object for UI display
      setFeedback({
        score: metrics.percentage_score,
        text: feedback.summary,
        wordCount,
        keyPointsCovered: metrics.relevance.keyPointsCovered,
        totalKeyPoints: selectedTopic.keyPoints.length,
        metrics,
        offTopic: false
      });
      
      // Save attempt if it's first completion or a higher score
      saveAttempt(selectedTopic, metrics.percentage_score, transcript, metrics);
      
    } catch (error) {
      console.error('Error analyzing response:', error);
      setError('Error analyzing your response. Please try again.');
    }
  };

  // Generate detailed feedback based on metrics
  const generateDetailedFeedback = (metrics) => {
    const feedback = {
      summary: "",
      strengths: [],
      improvements: []
    };
    if (metrics.offTopic) {
      feedback.summary = "Your response appears to be off-topic. Please try to address the selected topic directly.";
      feedback.improvements.push("Focus on addressing the topic: " + selectedTopic.title);
      
      // Add AI-generated feedback if available
      if (metrics.relevance && metrics.relevance.aiGeneratedFeedback) {
        feedback.improvements.push(metrics.relevance.aiGeneratedFeedback);
      }
      
      return feedback;
    }
    // Overall summary based on total score
    const totalScore = metrics.overall_score;
    if (totalScore >= 8) {
      feedback.summary = "Excellent! Your response was well-structured, clear, and comprehensive.";
    } else if (totalScore >= 6) {
      feedback.summary = "Very good speaking! You have strong skills with just a few areas to improve.";
    } else if (totalScore >= 4.5) {
      feedback.summary = "Good job! Your speaking shows progress with some areas for improvement.";
    } else if (totalScore >= 3) {
      feedback.summary = "You're making progress. Focus on speaking longer and using complete sentences.";
    } else {
      feedback.summary = "Keep practicing! Try to speak for at least 30 seconds using complete sentences.";
    }
    
    // Identify strengths
    if (metrics.speaking_duration.score >= 4) {
      feedback.strengths.push("You spoke for an appropriate length of time");
    }
    
    if (metrics.pronunciation.score >= 0.75) {
      feedback.strengths.push("Good pronunciation of words");
    }
    
    if (metrics.sentence_framing.score >= 0.75) {
      feedback.strengths.push("Well-structured sentences");
    }
    
    if (metrics.punctuation.score >= 0.75) {
      feedback.strengths.push("Good use of pauses and intonation");
    }
    
    // Identify areas for improvement
    if (metrics.speaking_duration.score < 4) {
      feedback.improvements.push(`Try to speak for at least 30 seconds (you spoke for ${Math.round(metrics.speaking_duration.duration_seconds)} seconds)`);
    }
    
    if (metrics.pronunciation.score < 0.75) {
      feedback.improvements.push("Practice pronouncing longer, more complex words");
    }
    
    if (metrics.sentence_framing.score < 0.75) {
      feedback.improvements.push("Work on forming complete sentences with clear subject-verb structure");
    }
    
    if (metrics.punctuation.score < 0.75) {
      feedback.improvements.push("Use appropriate pauses and varied intonation to indicate punctuation");
    }
    
    if (metrics.relevance.keyPointsCovered < metrics.relevance.totalKeyPoints * 0.6) {
      feedback.improvements.push(`Cover more key points in your response (you addressed ${metrics.relevance.keyPointsCovered} out of ${metrics.relevance.totalKeyPoints})`);
    }
    
    return feedback;
  };

  // Updated to use new database structure
  const saveAttempt = async (topic, score, transcript, metrics) => {
    try {
      if (!userId) {
        setError('User not logged in');
        return;
      }
      
      const attemptData = {
        timestamp: new Date().toISOString(),
        speaking_duration: metrics.speaking_duration.duration_seconds,
        minimum_duration_met: metrics.speaking_duration.duration_seconds >= 30,
        attempt_score: metrics.attempt.score,
        pronunciation_score: metrics.pronunciation.score,
        sentence_framing_score: metrics.sentence_framing.score,
        punctuation_score: metrics.punctuation.score,
        key_points_covered: metrics.relevance.keyPointsCovered,
        total_key_points: metrics.relevance.totalKeyPoints,
        overall_score: metrics.overall_score,
        percentage_score: metrics.percentage_score,
        transcript: transcript,
        feedback: generateDetailedFeedback(metrics)
      };
      
      const data = {
        topicId: topic.id,
        title: topic.title,
        attemptData: attemptData,
        isFirstCompletion: !completedTopics.includes(topic.id)
      };
      
      console.log(`Saving speaking attempt:`, data);
      
      await progressService.saveSpeakingAttempt(userId, data);
      
      // Update local state
      if (!completedTopics.includes(topic.id) && score >= 50) {
        setCompletedTopics([...completedTopics, topic.id]);
      }
      
      // Add to local attempt history for immediate display
      const newAttempt = {
        ...attemptData,
        topicId: topic.id,
        title: topic.title,
        date: attemptData.timestamp,
        score: attemptData.percentage_score
      };
      
      setAttemptHistory([newAttempt, ...attemptHistory]);
      
      // Update best attempt if needed
      if (!bestAttempt || newAttempt.percentage_score > bestAttempt.score) {
        setBestAttempt(newAttempt);
      }
      
      // Dispatch event to refresh progress in other components
      const progressEvent = new CustomEvent('progressUpdated', {
        detail: { userId, skillType, type: 'speaking', topicId: topic.id }
      });
      window.dispatchEvent(progressEvent);
      
      console.log('Speaking attempt saved and progressUpdated event dispatched');
    } catch (error) {
      console.error('Error saving attempt:', error);
      setError('Failed to save your attempt. Please try again.');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleBackToList = () => {
    setSelectedTopic(null);
    setTranscript('');
    setIsPreparing(false);
    setIsRecording(false);
    setFeedback(null);
    setDetailedScore(null);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
  };

  const tryAgain = () => {
    setTranscript('');
    setFeedback(null);
    setDetailedScore(null);
    setIsPreparing(false);
    setIsRecording(false);
    setTimeLeft(0);
  };

  const hasCompletedEnough = () => {
    return completedTopics.length >= Math.ceil(topics.length * 0.5);
  };

  // Enhanced score breakdown for the new metrics
// Enhanced score breakdown for the new metrics
const EnhancedScoreBreakdown = ({ scoreData }) => {
  if (!scoreData || !scoreData.metrics) return null;
  
  const { metrics } = scoreData;
  
  // Helper function for color coding
  const getScoreColor = (score, max) => {
    const ratio = score / max;
    if (ratio >= 0.8) return '#4caf50'; // green
    if (ratio >= 0.5) return '#ff9800'; // orange
    return '#f44336'; // red
  };
  
  return (
    <div className="speaking-enhanced-score-breakdown">
      <div className="speaking-score-header">
        <h3>Score Breakdown</h3>
        <div className="speaking-total-score">
          <div className="speaking-score-circle">
            <span className="speaking-score-number">{Math.round(scoreData.totalScore)}</span>
            <span className="speaking-score-max">/10</span>
          </div>
          <div className="speaking-score-percentage">{scoreData.percentageScore}%</div>
        </div>
      </div>
      
      <div className="speaking-new-score-categories">
        {/* Speaking Duration - 5 points */}
        <div className="speaking-score-category">
          <div className="speaking-category-header">
            <h4>Speaking Duration</h4>
            <div className="speaking-category-score">
              {metrics.speaking_duration?.score || 0}/5
            </div>
          </div>
          <div className="speaking-score-bar-container">
            <div 
              className="speaking-score-bar" 
              style={{ 
                width: `${(metrics.speaking_duration?.score / 5) * 100}%`,
                backgroundColor: getScoreColor(metrics.speaking_duration?.score || 0, 5)
              }}
            ></div>
          </div>
          <div className="speaking-category-details">
            {metrics.speaking_duration?.duration_seconds >= 30 ? (
              <div className="speaking-detail-item success">
                <span className="speaking-detail-check">✓</span> Spoke for minimum 30 seconds
              </div>
            ) : (
              <div className="speaking-detail-item warning">
                <span className="speaking-detail-x">✗</span> Need to speak for at least 30 seconds
              </div>
            )}
            
            <div className="speaking-detail-item">
              <span className="detail-label">Your duration:</span>
              <span className="detail-value">
                {Math.round(metrics.speaking_duration?.duration_seconds || 0)} seconds
              </span>
            </div>
          </div>
        </div>
        
        {/* Topic Relevance - if available */}
        {metrics.relevance && metrics.relevance.topicRelevanceScore !== undefined && (
          <div className="speaking-score-category">
            <div className="speaking-category-header">
              <h4>Topic Relevance</h4>
              <div className="speaking-category-score">
                {metrics.relevance.topicRelevanceScore}/5
              </div>
            </div>
            <div className="speaking-score-bar-container">
              <div 
                className="speaking-score-bar" 
                style={{ 
                  width: `${(metrics.relevance.topicRelevanceScore / 5) * 100}%`,
                  backgroundColor: getScoreColor(metrics.relevance.topicRelevanceScore, 5)
                }}
              ></div>
            </div>
            <div className="speaking-category-details">
              {metrics.relevance.isTopicRelevant ? (
                <div className="speaking-detail-item success">
                  <span className="speaking-detail-check">✓</span> On-topic response
                </div>
              ) : (
                <div className="speaking-detail-item warning">
                  <span className="speaking-detail-x">✗</span> Response appears off-topic
                </div>
              )}
              
              {metrics.relevance.keyPointsCovered > 0 && (
                <div className="speaking-detail-item">
                  <span className="detail-label">Key points covered:</span>
                  <span className="detail-value">
                    {metrics.relevance.keyPointsCovered} of {metrics.relevance.totalKeyPoints}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Attempt - 1 point */}
        <div className="speaking-score-category">
          <div className="speaking-category-header">
            <h4>Attempt</h4>
            <div className="speaking-category-score">
              {metrics.attempt?.score || 0}/1
            </div>
          </div>
          <div className="speaking-score-bar-container">
            <div 
              className="speaking-score-bar" 
              style={{ 
                width: `${(metrics.attempt?.score / 1) * 100}%`,
                backgroundColor: getScoreColor(metrics.attempt?.score || 0, 1)
              }}
            ></div>
          </div>
          <div className="speaking-category-details">
            <div className="speaking-detail-item success">
              <span className="speaking-detail-check">✓</span> Attempt completed
            </div>
          </div>
        </div>
        
        {/* Pronunciation - 1 point */}
        <div className="speaking-score-category">
          <div className="speaking-category-header">
            <h4>Pronunciation</h4>
            <div className="speaking-category-score">
              {metrics.pronunciation?.score || 0}/1
            </div>
          </div>
          <div className="speaking-score-bar-container">
            <div 
              className="speaking-score-bar" 
              style={{ 
                width: `${(metrics.pronunciation?.score / 1) * 100}%`,
                backgroundColor: getScoreColor(metrics.pronunciation?.score || 0, 1)
              }}
            ></div>
          </div>
          <div className="speaking-category-details">
            <div className="speaking-detail-item">
              <span className="detail-label">Pronunciation quality:</span>
              <span className="detail-value">
                {Math.round((metrics.pronunciation?.score || 0) * 100)}%
              </span>
            </div>
          </div>
        </div>
        
        {/* Sentence Framing - 1 point */}
        <div className="speaking-score-category">
          <div className="speaking-category-header">
            <h4>Sentence Framing</h4>
            <div className="speaking-category-score">
              {metrics.sentence_framing?.score || 0}/1
            </div>
          </div>
          <div className="speaking-score-bar-container">
            <div 
              className="speaking-score-bar" 
              style={{ 
                width: `${(metrics.sentence_framing?.score / 1) * 100}%`,
                backgroundColor: getScoreColor(metrics.sentence_framing?.score || 0, 1)
              }}
            ></div>
          </div>
          <div className="speaking-category-details">
            <div className="speaking-detail-item">
              <span className="detail-label">Complete sentences:</span>
              <span className="detail-value">
                {metrics.sentence_framing?.quality_score || 0}
              </span>
            </div>
          </div>
        </div>
        
        {/* Punctuation - 1 point */}
        <div className="speaking-score-category">
          <div className="speaking-category-header">
            <h4>Punctuation</h4>
            <div className="speaking-category-score">
              {metrics.punctuation?.score || 0}/1
            </div>
          </div>
          <div className="speaking-score-bar-container">
            <div 
              className="speaking-score-bar" 
              style={{ 
                width: `${(metrics.punctuation?.score / 1) * 100}%`,
                backgroundColor: getScoreColor(metrics.punctuation?.score || 0, 1)
              }}
            ></div>
          </div>
          <div className="speaking-category-details">
            <div className="speaking-detail-item">
              <span className="detail-label">Pauses/intonations:</span>
              <span className="detail-value">
                {metrics.punctuation?.punctuation_count || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Additional Information */}
      <div className="speaking-additional-metrics">
        <h4>Additional Information</h4>
        <div className="speaking-detail-item">
          <span className="detail-label">Word Count:</span>
          <span className="detail-value">{metrics.wordCount}</span>
        </div>
        <div className="speaking-detail-item">
          <span className="detail-label">Key Points Covered:</span>
          <span className="detail-value">{metrics.keyPointsCovered} of {metrics.totalKeyPoints}</span>
        </div>
      </div>
      
      {/* Feedback Section */}
      {feedback && (
        <div className="speaking-enhanced-feedback-section">
          <h4>Feedback</h4>
          <p className="feedback-summary">{feedback.summary}</p>
          
          {feedback.strengths?.length > 0 && (
            <div className="feedback-strengths">
              <h5>Strengths:</h5>
              <ul>
                {feedback.strengths.map((strength, index) => (
                  <li key={`strength-${index}`}>{strength}</li>
                ))}
              </ul>
            </div>
          )}
          
          {feedback.improvements?.length > 0 && (
            <div className="feedback-improvements">
              <h5>Areas for Improvement:</h5>
              <ul>
                {feedback.improvements.map((improvement, index) => (
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

  // Enhanced attempt history component
  const EnhancedAttemptHistory = () => {
    if (attemptHistory.length === 0) return null;
    
    // Format date for display
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
  };

  return (
    <div className="speaking-container">
      {accessError && (
  <ModuleAccessAlert
    message={accessError.message}
    redirectPath={accessError.redirectPath}
    onClose={() => setAccessError(null)}
  />)}
      {/* {loading && (
        <div className="speaking-loading">
          <div className="speaking-spinner"></div>
          <p>Loading speaking exercises...</p>
        </div>
      )} */}
      
      {error && (
        <div className="speaking-error">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="speaking-clear-error">
            Dismiss
          </button>
        </div>
      )}
      
      {topicsLoaded && (
        <>
          <div className="speaking-header">
          <div className='SpeakingSection-infoSection'>
          <h1>Speaking Training</h1>
          <p>Practice your speaking skills by responding to prompts on various topics.</p>
          <p>You are allowed up to three attempts per passage.</p>
              <p>
                Consistent practice will help you earn higher rankings and
                achieve mastery.
              </p>
              <p>
              Choose any 10 topics to complete the module 
            </p>
          </div>
            
            
            <div className="speaking-progress">
              <h3>Module Progress
               {/* ({Math.round(calculateCompletionPercentage())}%) */}
               </h3>
              <ProgressBar percentage={calculateCompletionPercentage()} />
              
              {hasCompletedEnough() ? (
                <div className="speaking-progress-message success">
                  <span className="speaking-checkmark">✓</span>
                  Congratulations! You have completed the Speaking module!
                </div>
              ) : (
                <div className="speaking-progress-message">
                  Complete {Math.ceil(topics.length * 0.5) - completedTopics.length} more topic(s) to complete this module.
                </div>
              )}
              
              {hasCompletedEnough() && (
                <div className="speaking-module-completion">
                  <h3>{skillType.charAt(0).toUpperCase() + skillType.slice(1)} Training Complete!</h3>
                  <p>You have successfully completed all required modules of the {skillType} training.</p>
                  <div className="speaking-completion-badge">
                    <span className="speaking-badge-checkmark">✓</span>
                    <span>Training Completed</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {!selectedTopic ? (
            <div className="speaking-topic-list">
              <h2>Select a Speaking Topic</h2>
              <div className="speaking-instruction">
                <p>Choose a topic from the list below to start practicing your speaking skills.</p>
              </div>
              <div className="speaking-cards-grid">
                {topics.map(topic => (
                  <div 
                    className={`speaking-card ${isTopicCompleted(topic.id) ? 'completed' : ''}`}
                    key={topic.id}
                    onClick={() => selectTopic(topic)}
                  >
                    <h3>
                      {topic.title}
                      {isTopicCompleted(topic.id) && <span className="speaking-card-checkmark">✓</span>}
                    </h3>
                    <div className="speaking-card-content">
                      <p>{topic.prompt}</p>
                    </div>
                    <div className="speaking-card-footer">
                      <span className="speaking-card-level">{topic.level}</span>
                      <span className="speaking-time-limit">{Math.floor(topic.timeLimit / 60)} min</span>
                      {isTopicCompleted(topic.id) && <span className="speaking-card-completed">Completed</span>}
                    </div>
                  </div>
                ))}
              </div>
              {!progressLoaded && (
                <div className="progress-loading">
                  <p>Loading progress data...</p>
                </div>
              )}
              
              {attemptHistory.length > 0 && (
                <EnhancedAttemptHistory />
              )}
            </div>
          ) : (
            <div className="speaking-practice">
              <div className="speaking-exercise-header">
                <h2>{selectedTopic.title}</h2>
                <button 
                  className="speaking-back-button" 
                  onClick={handleBackToList}
                  disabled={isRecording || isPreparing}
                >
                  ← Back to topics
                </button>
              </div>
              
              <div className="speaking-topic-prompt">
                <h3>Speaking Prompt:</h3>
                <p>{selectedTopic.prompt}</p>
              </div>
              
              {selectedTopic.tips && selectedTopic.tips.length > 0 && (
                <div className="speaking-tips-section">
                  <h3>Speaking Tips:</h3>
                  <ul className="speaking-tips-list">
                    {selectedTopic.tips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {(isPreparing || isRecording || timeLeft > 0) && (
                <div className="speaking-timer-container">
                  <div className="speaking-timer">
                    <span className="speaking-time-display">{formatTime(timeLeft)}</span>
                    <span className="speaking-time-label">
                      {isPreparing ? 'Preparation Time' : 'Speaking Time'}
                    </span>
                  </div>
                </div>
              )}
              
              <div className="speaking-practice-controls">
                {!isPreparing && !isRecording && !feedback && (
                  <button 
                    className="speaking-prepare-button"
                    onClick={startPreparation}
                  >
                    Start 30s Preparation
                  </button>
                )}
                
                {isPreparing && (
                  <div className="speaking-preparation-status">
                    <p>Think about what you want to say...</p>
                    <button 
                      className="speaking-start-button"
                      onClick={startRecording}
                    >
                      Skip Prep & Start Speaking
                    </button>
                  </div>
                )}
                
                {!isPreparing && !isRecording && !feedback && (
                  <button 
                    className="speaking-start-button"
                    onClick={startRecording}
                  >
                    Start Speaking (Skip Prep)
                  </button>
                )}
                
                {isRecording && (
                  <div className="speaking-recording-buttons">
                    <div className="speaking-recording-status">
                      <div className="speaking-recording-indicator"></div>
                      <p>Recording... Speak clearly for at least 30 seconds</p>
                    </div>
                    <button 
                      className="speaking-stop-button"
                      onClick={stopRecording}
                    >
                      Stop Recording
                    </button>
                  </div>
                )}
              </div>
              
              {transcript && !isRecording && (
                <div className="speaking-transcript-container">
                  <h3>Your Response:</h3>
                  <p className="speaking-transcript-text">{transcript}</p>
                  <div className="speaking-word-count">
                    Word count: {transcript.split(/\s+/).filter(w => w.trim().length > 0).length}
                  </div>
                </div>
              )}
              
              {feedback && (
                  <div className="speaking-feedback-container">
                    <h3>Feedback</h3>
                    
                    {feedback.offTopic ? (
                      // Off-topic feedback display
                      <div className="speaking-off-topic-feedback">
                        <div className="speaking-off-topic-warning" style={{ 
                          backgroundColor: "#fff3cd", 
                          border: "1px solid #ffeeba", 
                          padding: "15px", 
                          borderRadius: "4px", 
                          marginBottom: "20px",
                          textAlign: "center"
                        }}>
                          <span style={{ fontSize: "24px", marginRight: "10px" }}>⚠️</span>
                          <div>
                            <p style={{ margin: "0 0 10px 0", fontWeight: "bold", fontSize: "18px" }}>
                              Your response is off-topic
                            </p>
                            <p style={{ margin: "0 0 15px 0" }}>
                              {feedback.text}
                            </p>
                            {feedback.explanation && (
                              <p style={{ margin: "0", fontStyle: "italic" }}>
                                {feedback.explanation}
                              </p>
                            )}
                            <button 
                              className="speaking-retry-button" 
                              onClick={tryAgain}
                              style={{ 
                                marginTop: "15px", 
                                padding: "10px 20px",
                                backgroundColor: "#007bff",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                fontWeight: "bold"
                              }}
                            >
                              Try Again
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Normal feedback display for on-topic responses
                      <>
                        <div className="speaking-accuracy-meter">
                          <div 
                            className="speaking-accuracy-bar" 
                            style={{ 
                              width: `${feedback.score}%`,
                              backgroundColor: feedback.score >= 80 ? '#4caf50' : 
                                            feedback.score >= 60 ? '#ff9800' : '#f44336'
                            }}
                          ></div>
                          <span className="speaking-accuracy-value">{feedback.score}% Score</span>
                        </div>
                        
                        <div className="speaking-feedback-details">
                          <p><strong>Word Count:</strong> {feedback.wordCount}</p>
                          <p><strong>Key Points Covered:</strong> {feedback.keyPointsCovered} of {feedback.totalKeyPoints}</p>
                        </div>
                        
                        <p className="speaking-feedback-text">{feedback.text}</p>
                        
                        {detailedScore && (
                          <EnhancedScoreBreakdown scoreData={detailedScore} />
                        )}
                        
                        {feedback.score >= 60 && !isTopicCompleted(selectedTopic.id) && (
                          <div className="speaking-completion-notification">
                            <span className="speaking-checkmark">✓</span>
                            Congratulations! This topic has been marked as completed.
                          </div>
                        )}
                        
                        <div className="speaking-action-buttons">
                          <button className="speaking-retry-button" onClick={tryAgain}>
                            Try Again
                          </button>
                          
                          <button className="speaking-back-to-topics-button" onClick={handleBackToList}>
                            Back to Topic List
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SpeakingTraining;
