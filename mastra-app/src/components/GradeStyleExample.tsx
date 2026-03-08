import React from 'react';

/**
 * Example component demonstrating performance grade styling usage
 * 
 * This component shows how to use the grade styling classes implemented
 * according to UX Enhancement MVP Requirement 26.
 */
export const GradeStyleExample: React.FC = () => {
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold mb-4">Performance Grade Styling Examples</h2>
      
      {/* Text Color Examples */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Text Color Classes</h3>
        <div className="flex gap-4 flex-wrap">
          <span className="grade-green font-semibold">A Grade (Green)</span>
          <span className="grade-a font-semibold">A Grade Alt</span>
          <span className="grade-b font-semibold">B Grade (Green)</span>
          <span className="grade-yellow font-semibold">C Grade (Yellow)</span>
          <span className="grade-c font-semibold">C Grade Alt</span>
          <span className="grade-red font-semibold">D Grade (Red)</span>
          <span className="grade-d font-semibold">D Grade Alt</span>
          <span className="grade-f font-semibold">F Grade (Red)</span>
        </div>
      </div>

      {/* Background Color Examples */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Background Color Classes</h3>
        <div className="flex gap-2 flex-wrap">
          <div className="bg-grade-green text-white px-3 py-2 rounded">A/B Background</div>
          <div className="bg-grade-a text-white px-3 py-2 rounded">A Background Alt</div>
          <div className="bg-grade-b text-white px-3 py-2 rounded">B Background Alt</div>
          <div className="bg-grade-yellow text-white px-3 py-2 rounded">C Background</div>
          <div className="bg-grade-c text-white px-3 py-2 rounded">C Background Alt</div>
          <div className="bg-grade-red text-white px-3 py-2 rounded">D/F Background</div>
          <div className="bg-grade-d text-white px-3 py-2 rounded">D Background Alt</div>
          <div className="bg-grade-f text-white px-3 py-2 rounded">F Background Alt</div>
        </div>
      </div>

      {/* Performance Metrics Example */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Performance Metrics Visualization</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold grade-a">A</div>
            <div className="text-sm text-gray-600">Query Performance</div>
            <div className="text-xs text-gray-500">95-100%</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold grade-b">B</div>
            <div className="text-sm text-gray-600">Response Time</div>
            <div className="text-xs text-gray-500">85-94%</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold grade-c">C</div>
            <div className="text-sm text-gray-600">Accuracy</div>
            <div className="text-xs text-gray-500">75-84%</div>
          </div>
          <div className="border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold grade-f">F</div>
            <div className="text-sm text-gray-600">Error Rate</div>
            <div className="text-xs text-gray-500">Below 60%</div>
          </div>
        </div>
      </div>

      {/* Badge Examples */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Grade Badges</h3>
        <div className="flex gap-2 flex-wrap">
          <span className="bg-grade-green text-white px-2 py-1 rounded-full text-sm font-medium">
            Excellent (A)
          </span>
          <span className="bg-grade-b text-white px-2 py-1 rounded-full text-sm font-medium">
            Good (B)
          </span>
          <span className="bg-grade-yellow text-white px-2 py-1 rounded-full text-sm font-medium">
            Average (C)
          </span>
          <span className="bg-grade-red text-white px-2 py-1 rounded-full text-sm font-medium">
            Poor (D/F)
          </span>
        </div>
      </div>

      {/* Color Reference */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium">Color Reference</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div>• A/B Grades: <span className="grade-green font-mono">#10B981 (Green)</span></div>
          <div>• C Grades: <span className="grade-yellow font-mono">#F59E0B (Yellow)</span></div>
          <div>• D/F Grades: <span className="grade-red font-mono">#EF4444 (Red)</span></div>
        </div>
      </div>
    </div>
  );
};

export default GradeStyleExample;