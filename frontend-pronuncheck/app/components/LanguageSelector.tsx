"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/app/contexts/LanguageContext";
import { Globe } from "lucide-react";

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (lang: "vi" | "en" | "de") => {
    setLanguage(lang);
    setIsOpen(false);
  };

  const languages: { code: "vi" | "en" | "de"; label: string }[] = [
    { code: "vi", label: "🇻🇳 " + t("language.vi") },
    { code: "en", label: "🇬🇧 " + t("language.en") },
    { code: "de", label: "🇩🇪 " + t("language.de") },
  ];

  return (
    <div className="relative inline-block text-left z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Globe className="w-4 h-4 text-gray-400" />
        <span className="hidden sm:inline-block">
          {languages.find((l) => l.code === language)?.label || language}
        </span>
        <span className="sm:hidden uppercase">{language}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg shadow-xl bg-gray-800 border border-gray-700 ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`${
                  language === lang.code ? "bg-gray-700 text-blue-400 font-bold" : "text-gray-300 hover:bg-gray-700 hover:text-white"
                } group flex w-full items-center px-4 py-2 text-sm text-left transition-colors`}
                role="menuitem"
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
