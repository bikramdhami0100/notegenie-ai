import React, { useState, useEffect, useCallback } from 'react';
import { generateSyllabus, generateTopicContent } from './services/gemini';
import { loadCourses, saveCourses } from './services/storage';
import { Course, SyllabusTopic, DifficultyLevel } from './types';
import MarkdownContent from './components/MarkdownContent';
import { BookOpen, ChevronRight, Loader2, CheckCircle, Cloud, Sparkles, Database, Youtube, Trash2 } from './components/Icons';

export default function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [currentCourseId, setCurrentCourseId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  
  // UI States
  const [searchInput, setSearchInput] = useState('');
  const [isGeneratingSyllabus, setIsGeneratingSyllabus] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [storageStatus, setStorageStatus] = useState<'local' | 'cloud'>('local');

  // Load initial data
  useEffect(() => {
    const loaded = loadCourses();
    setCourses(loaded);
    if (loaded.length > 0) {
      setCurrentCourseId(loaded[0].id);
    }
  }, []);

  // Save on change
  useEffect(() => {
    if (courses.length > 0) {
      const result = saveCourses(courses);
      setStorageStatus(result.storageType);
    }
  }, [courses]);

  const currentCourse = courses.find(c => c.id === currentCourseId);
  const currentTopic = currentCourse?.topics.find(t => t.id === selectedTopicId);

  const handleCreateSyllabus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;

    setIsGeneratingSyllabus(true);
    try {
      const topics = await generateSyllabus(searchInput);
      
      const newCourse: Course = {
        id: crypto.randomUUID(),
        subject: searchInput,
        createdAt: Date.now(),
        topics: topics.map(t => ({ ...t, status: 'pending' })),
      };

      setCourses(prev => [newCourse, ...prev]);
      setCurrentCourseId(newCourse.id);
      setSearchInput('');
      
      // Auto select first topic? No, let user choose.
    } catch (error) {
      alert("Failed to generate syllabus. Please try again.");
    } finally {
      setIsGeneratingSyllabus(false);
    }
  };

  const handleGenerateContent = async (topicId: string) => {
    if (!currentCourse) return;

    // Optimistic update
    setCourses(prev => prev.map(c => {
      if (c.id === currentCourse.id) {
        return {
          ...c,
          topics: c.topics.map(t => t.id === topicId ? { ...t, status: 'generating' } : t)
        };
      }
      return c;
    }));
    
    setSelectedTopicId(topicId);

    try {
      const topic = currentCourse.topics.find(t => t.id === topicId);
      if (!topic) throw new Error("Topic not found");

      const content = await generateTopicContent(currentCourse.subject, topic);

      // We need to parse the content to "hyperlink" the YouTube search terms if possible
      // For now, we append a helper function logic inside render or just let Markdown handle it
      // Let's add a post-process to add actual links if the model didn't (Gemini usually follows instructions well though)
      
      const processedContent = content.replace(
        /(?:search for|search query|watch):?\s*"([^"]+)"/gi,
        (match, query) => {
          const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
          return `[📺 Watch: ${query}](${url})`;
        }
      );

      setCourses(prev => prev.map(c => {
        if (c.id === currentCourse.id) {
          return {
            ...c,
            topics: c.topics.map(t => t.id === topicId ? { 
              ...t, 
              status: 'completed', 
              content: processedContent,
              lastUpdated: Date.now() 
            } : t)
          };
        }
        return c;
      }));

    } catch (error) {
       setCourses(prev => prev.map(c => {
        if (c.id === currentCourse.id) {
          return {
            ...c,
            topics: c.topics.map(t => t.id === topicId ? { ...t, status: 'error' } : t)
          };
        }
        return c;
      }));
    }
  };

  const handleDeleteCourse = (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('Are you sure you want to delete this course?')) {
        setCourses(prev => prev.filter(c => c.id !== courseId));
        if (currentCourseId === courseId) {
            setCurrentCourseId(null);
            setSelectedTopicId(null);
        }
    }
  }

  // Group topics by level
  const groupedTopics = currentCourse ? {
    Basic: currentCourse.topics.filter(t => t.level === DifficultyLevel.Basic),
    Intermediate: currentCourse.topics.filter(t => t.level === DifficultyLevel.Intermediate),
    Advanced: currentCourse.topics.filter(t => t.level === DifficultyLevel.Advanced),
  } : null;

  return (
    <div className="flex h-screen bg-white">
      {/* Mobile Sidebar Overlay */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-indigo-600 text-white rounded-md shadow-lg md:hidden"
        >
          <BookOpen className="w-6 h-6" />
        </button>
      )}

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} transform transition-transform duration-300 md:translate-x-0 fixed md:relative z-40 w-80 h-full bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800 shadow-xl`}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div className="flex items-center gap-2 font-bold text-xl text-indigo-400">
            <Sparkles className="w-5 h-5" />
            <span>NoteGenie</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
        </div>

        {/* Course Selector / Creator */}
        <div className="p-4 bg-slate-900 border-b border-slate-800">
             <form onSubmit={handleCreateSyllabus} className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                New Study Goal
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="e.g. Python, History of Jazz..."
                  className="w-full bg-slate-800 text-sm px-3 py-2 rounded border border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-500"
                />
                <button 
                  type="submit" 
                  disabled={isGeneratingSyllabus || !searchInput}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed p-2 rounded transition-colors"
                >
                  {isGeneratingSyllabus ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </form>

            <div className="mb-2 flex justify-between items-end">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    My Courses
                </label>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                     {storageStatus === 'local' ? <Database className="w-3 h-3"/> : <Cloud className="w-3 h-3 text-green-400"/>}
                     {storageStatus === 'local' ? 'Local' : 'Cloud'}
                </div>
            </div>
            
            <div className="space-y-1 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
              {courses.map(course => (
                <div 
                  key={course.id}
                  onClick={() => { setCurrentCourseId(course.id); setSelectedTopicId(null); }}
                  className={`group flex items-center justify-between px-3 py-2 rounded cursor-pointer text-sm transition-colors ${currentCourseId === course.id ? 'bg-indigo-900/50 text-indigo-200 border border-indigo-500/30' : 'hover:bg-slate-800 text-slate-400'}`}
                >
                  <span className="truncate flex-1">{course.subject}</span>
                  <button onClick={(e) => handleDeleteCourse(course.id, e)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1">
                    <Trash2 className="w-3 h-3"/>
                  </button>
                </div>
              ))}
              {courses.length === 0 && (
                <div className="text-center text-xs text-slate-600 py-4 italic">
                    No courses yet. Start by entering a topic above.
                </div>
              )}
            </div>
        </div>

        {/* Syllabus Tree */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {currentCourse && groupedTopics ? (
            Object.entries(groupedTopics).map(([level, topics]) => (
              topics.length > 0 && (
                <div key={level}>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 sticky top-0 bg-slate-900 py-1 z-10 border-b border-slate-800">
                    {level}
                  </h3>
                  <div className="space-y-2 relative border-l border-slate-700 ml-2 pl-4">
                    {topics.map(topic => (
                      <div 
                        key={topic.id}
                        onClick={() => {
                            if (topic.status === 'completed') setSelectedTopicId(topic.id);
                            else handleGenerateContent(topic.id);
                        }}
                        className={`relative cursor-pointer group transition-all duration-200 ${selectedTopicId === topic.id ? 'scale-105 origin-left' : ''}`}
                      >
                         {/* Connector Dot */}
                         <div className={`absolute -left-[21px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-slate-900 transition-colors ${
                             topic.status === 'completed' ? 'bg-green-500' : 
                             topic.status === 'generating' ? 'bg-indigo-500 animate-pulse' : 
                             topic.status === 'error' ? 'bg-red-500' : 'bg-slate-600'
                         }`} />

                        <div className={`p-3 rounded-lg border transition-all ${
                          selectedTopicId === topic.id 
                            ? 'bg-slate-800 border-indigo-500 shadow-md shadow-indigo-900/20' 
                            : 'bg-slate-800/50 border-transparent hover:bg-slate-800 hover:border-slate-700'
                        }`}>
                          <div className="flex justify-between items-start mb-1">
                            <h4 className={`text-sm font-medium ${selectedTopicId === topic.id ? 'text-indigo-300' : 'text-slate-300'}`}>
                              {topic.title}
                            </h4>
                            {topic.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                            {topic.status === 'generating' && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {topic.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center px-6">
               <BookOpen className="w-12 h-12 mb-4 opacity-20" />
               <p className="text-sm">Select or create a course to view the syllabus.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-white flex flex-col relative h-full">
        {currentCourse ? (
            currentTopic ? (
            <div className="max-w-4xl mx-auto w-full p-8 md:p-12 pb-32 animate-fade-in">
                 {/* Breadcrumbs */}
                 <div className="flex items-center gap-2 text-sm text-slate-400 mb-6">
                    <span>{currentCourse.subject}</span>
                    <ChevronRight className="w-4 h-4" />
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        currentTopic.level === DifficultyLevel.Basic ? 'bg-green-50 text-green-700 border-green-200' :
                        currentTopic.level === DifficultyLevel.Intermediate ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-purple-50 text-purple-700 border-purple-200'
                    }`}>
                        {currentTopic.level}
                    </span>
                 </div>

                 {/* Title Header */}
                 <div className="border-b border-slate-100 pb-8 mb-8">
                     <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                        {currentTopic.title}
                     </h1>
                     <p className="text-lg text-slate-600 leading-relaxed">
                        {currentTopic.description}
                     </p>
                 </div>

                 {/* Content Status Handling */}
                 {currentTopic.status === 'completed' && currentTopic.content ? (
                    <>
                        <MarkdownContent content={currentTopic.content} />
                        
                        {/* Static Footer Tip */}
                        <div className="mt-12 p-6 bg-indigo-50 rounded-xl border border-indigo-100 flex gap-4 items-start">
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                <Youtube className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="font-bold text-indigo-900 mb-1">Learning Tip</h4>
                                <p className="text-sm text-indigo-700">
                                    Watch the recommended videos above to reinforce your understanding. Visual learning often helps clarify complex abstract concepts found in {currentTopic.title}.
                                </p>
                            </div>
                        </div>
                    </>
                 ) : currentTopic.status === 'generating' ? (
                     <div className="flex flex-col items-center justify-center py-20 space-y-6">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                            <Sparkles className="w-6 h-6 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-slate-800">Generating Study Notes</h3>
                            <p className="text-slate-500">Creating custom examples and finding video links...</p>
                        </div>
                     </div>
                 ) : (
                     <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <p className="text-slate-500 mb-4">Content not yet generated.</p>
                        <button 
                            onClick={() => handleGenerateContent(currentTopic.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 hover:-translate-y-1"
                        >
                            <Sparkles className="w-5 h-5" />
                            Generate Notes & Examples
                        </button>
                     </div>
                 )}
            </div>
            ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50/50">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <BookOpen className="w-10 h-10 text-slate-300" />
                </div>
                <h2 className="text-xl font-bold text-slate-700 mb-2">Ready to Study?</h2>
                <p className="max-w-md mx-auto mb-8">Select a topic from the sidebar to view details, or click a "pending" topic to generate comprehensive AI notes.</p>
                {courses.length === 0 && (
                     <div className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded text-sm animate-bounce">
                        ← Start by creating a course in the sidebar!
                     </div>
                )}
            </div>
            )
        ) : (
             <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-700 mb-2">Welcome to NoteGenie</h2>
                <p className="max-w-md mx-auto">Create a syllabus to get started.</p>
            </div>
        )}
      </div>
    </div>
  );
}