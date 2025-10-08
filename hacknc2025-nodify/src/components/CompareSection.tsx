"use client";

import React from "react";
import { motion } from "framer-motion";

export default function CompareSection() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-80 bg-[#fffaf3] shadow-lg border-l border-[#e6dccb] h-full flex flex-col"
    >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-[#e6dccb] bg-gradient-to-r from-[#f7f2e8] to-[#f3eadb]">
            <h2 className="text-lg font-semibold text-[#171717]">Ideas...</h2>
            <p className="text-sm text-[#6b7280] mt-1">Arguments and counter-arguments on board</p>
          </div>

          {/* Two Distinctive Sections */}
          <div className="flex-1 flex flex-col">
            {/* Section 1 - Argument (White) */}
            <motion.div 
              className="flex-none p-4 bg-white border-b border-[#e5e7eb]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-[#10b981] rounded-full"></div>
                <h3 className="font-medium text-[#171717]">Argument</h3>
              </div>
              <div className="space-y-3">
                <div className="bg-[#f9fafb] rounded-lg p-3 border border-[#e5e7eb]">
                  <h4 className="text-sm font-medium text-[#171717] mb-2">Main Point</h4>
                  <p className="text-sm text-[#6b7280]">Your main argument goes here...</p>
                </div>
                <div className="bg-[#f9fafb] rounded-lg p-3 border border-[#e5e7eb]">
                  <h4 className="text-sm font-medium text-[#171717] mb-2">Supporting Evidence</h4>
                  <ul className="text-sm text-[#6b7280] space-y-1">
                    <li>• Evidence 1</li>
                    <li>• Evidence 2</li>
                    <li>• Evidence 3</li>
                  </ul>
                </div>
                <div className="bg-[#f9fafb] rounded-lg p-3 border border-[#e5e7eb]">
                  <h4 className="text-sm font-medium text-[#171717] mb-2">Strengths</h4>
                  <ul className="text-sm text-[#6b7280] space-y-1">
                    <li>• Strength 1</li>
                    <li>• Strength 2</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Section 2 - Anti-Argument (Dark Gray) */}
            <motion.div 
              className="flex-1 p-4 bg-[#374151]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 bg-[#ef4444] rounded-full"></div>
                <h3 className="font-medium text-white">Anti-Argument</h3>
              </div>
              <div className="space-y-3">
                <div className="bg-[#4b5563] rounded-lg p-3 border border-[#6b7280]">
                  <h4 className="text-sm font-medium text-white mb-2">Counter Point</h4>
                  <p className="text-sm text-[#d1d5db]">Your counter-argument goes here...</p>
                </div>
                <div className="bg-[#4b5563] rounded-lg p-3 border border-[#6b7280]">
                  <h4 className="text-sm font-medium text-white mb-2">Counter Evidence</h4>
                  <ul className="text-sm text-[#d1d5db] space-y-1">
                    <li>• Counter-evidence 1</li>
                    <li>• Counter-evidence 2</li>
                    <li>• Counter-evidence 3</li>
                  </ul>
                </div>
                <div className="bg-[#4b5563] rounded-lg p-3 border border-[#6b7280]">
                  <h4 className="text-sm font-medium text-white mb-2">Weaknesses</h4>
                  <ul className="text-sm text-[#d1d5db] space-y-1">
                    <li>• Weakness 1</li>
                    <li>• Weakness 2</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
    </motion.div>
  );
}
