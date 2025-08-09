import React, { useState, useEffect, useRef } from 'react';
import { Lightbulb, BookOpen, Sparkles, Loader, RefreshCw, ArrowRight } from 'lucide-react';
import { eli5Service } from '../services/eli5Service';

// --- AIReader Component (inline) ---
const AIReader = ({ text }) => {
  const synth = window.speechSynthesis;
  const utteranceRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const speak = () => {
    if (synth.speaking) synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utteranceRef.current = utterance;
    synth.speak(utterance);
  };

  const pause = () => {
    synth.pause();
    setIsPaused(true);
  };

  const resume = () => {
    synth.resume();
    setIsPaused(false);
  };

  const stop = () => {
    synth.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  // Animation styles
  const baseBtn =
    "px-3 py-1 rounded transition-all duration-200 font-medium shadow hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-400";
  const playBtn =
    baseBtn +
    " bg-green-500 text-white hover:bg-green-600 " +
    (isSpeaking ? "animate-pulse" : "");
  const pauseBtn =
    baseBtn +
    " bg-yellow-400 text-white hover:bg-yellow-500 " +
    (isPaused ? "animate-bounce" : "");
  const resumeBtn =
    baseBtn +
    " bg-blue-500 text-white hover:bg-blue-600 " +
    (isPaused ? "animate-pulse" : "");
  const stopBtn =
    baseBtn +
    " bg-red-500 text-white hover:bg-red-600 " +
    (isSpeaking ? "animate-bounce" : "");

  return (
    <div style={{ margin: "1em 0" }}>
      <div style={{ display: "flex", gap: "0.5em" }}>
        <button
          className={playBtn}
          onClick={speak}
          disabled={isSpeaking || !text}
        >
          Play
        </button>
        <button
          className={pauseBtn}
          onClick={pause}
          disabled={!isSpeaking || isPaused}
        >
          Pause
        </button>
        <button
          className={resumeBtn}
          onClick={resume}
          disabled={!isPaused}
        >
          Resume
        </button>
        <button
          className={stopBtn}
          onClick={stop}
          disabled={!isSpeaking}
        >
          Stop
        </button>
      </div>
    </div>
  );
};
// --- End AIReader Component ---

const ELI5 = () => {
  const [topic, setTopic] = useState('');
  const [complexityLevel, setComplexityLevel] = useState('basic');
  const [complexityLevels, setComplexityLevels] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState(null);

  useEffect(() => {
    // Get complexity levels when component mounts
    const getLevels = async () => {
      try {
        const { complexity_levels } = await eli5Service.getComplexityLevels();
        setComplexityLevels(complexity_levels);
      } catch (err) {
        console.error('Failed to get complexity levels:', err);
      }
    };
    getLevels();
  }, []);

  const handleSimplify = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic to simplify');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const result = await eli5Service.simplifyTopic(topic, complexityLevel);
      setExplanation(result);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to simplify topic');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTopic('');
    setComplexityLevel('basic');
    setExplanation(null);
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ELI5 Simplifier</h1>
          <p className="text-gray-600 dark:text-gray-400">Simplify complex topics for better understanding</p>
        </div>
        <div className="flex items-center space-x-2">
          <Lightbulb className="h-8 w-8 text-primary-600" />
        </div>
      </div>

      <div className="card">
        <div className="p-6">
          {!explanation && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Topic to Simplify
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter a complex topic or concept..."
                  className="w-full h-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Complexity Level
                </label>
                <select
                  value={complexityLevel}
                  onChange={(e) => setComplexityLevel(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-gray-800"
                >
                  {complexityLevels.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.description}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="text-red-500 text-sm">
                  {error}
                </div>
              )}

              <button
                className="btn-primary w-full flex items-center justify-center"
                onClick={handleSimplify}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Simplifying...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Simplify Topic
                  </>
                )}
              </button>
            </div>
          )}

          {explanation && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">{explanation.original_topic}</h2>
                <button
                  onClick={resetForm}
                  className="btn-secondary flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  New Topic
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2 flex items-center text-primary-600">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Simple Explanation
                  </h3>
                  <p className="text-gray-700 dark:text-gray-300">
                    {explanation.simple_explanation}
                  </p>
                  {/* AIReader for simple explanation */}
                  <AIReader text={explanation.simple_explanation} />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Key Concepts</h3>
                    <ul className="space-y-2">
                      {explanation.key_concepts.map((concept, index) => (
                        <li key={index} className="flex items-start">
                          <ArrowRight className="h-4 w-4 mr-2 mt-1 text-primary-600" />
                          <span>{concept}</span>
                        </li>
                      ))}
                    </ul>
                    {/* AIReader for key concepts */}
                    <AIReader text={explanation.key_concepts.join('. ')} />
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Examples</h3>
                    <ul className="space-y-2">
                      {explanation.examples.map((example, index) => (
                        <li key={index} className="flex items-start">
                          <Sparkles className="h-4 w-4 mr-2 mt-1 text-primary-600" />
                          <span>{example}</span>
                        </li>
                      ))}
                    </ul>
                    {/* AIReader for examples */}
                    <AIReader text={explanation.examples.join('. ')} />
                  </div>
                </div>

                {explanation.analogies.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Helpful Analogies</h3>
                    <ul className="space-y-2">
                      {explanation.analogies.map((analogy, index) => (
                        <li key={index} className="flex items-start">
                          <BookOpen className="h-4 w-4 mr-2 mt-1 text-primary-600" />
                          <span>{analogy}</span>
                        </li>
                      ))}
                    </ul>
                    {/* AIReader for analogies */}
                    <AIReader text={explanation.analogies.join('. ')} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 

export default ELI5;