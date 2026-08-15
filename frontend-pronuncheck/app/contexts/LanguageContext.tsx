"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "vi" | "en" | "de";

const dictionary: Record<Language, Record<string, string>> = {
  vi: {
    "language.vi": "Tiếng Việt",
    "language.en": "English",
    "language.de": "Deutsch",
    "app.title": "PronunCheck",
    "role.student": "Học sinh",
    "role.teacher": "Giáo viên",
    "auth.logout": "Đăng xuất",
    "auth.login": "Đăng nhập",
    "auth.register": "Đăng ký",
    "auth.email": "Email",
    "auth.password": "Mật khẩu",
    "auth.processing": "Đang xử lý...",
    "home.question": "Bạn muốn tham gia với vai trò gì?",
    "home.student.desc": "Luyện tập phát âm, tham gia lớp học và nhận phản hồi tức thì.",
    "home.teacher.desc": "Tạo lớp học, giao bài tập và theo dõi kết quả của học sinh.",
    "home.update_account": "Cập nhật tài khoản",
    "home.update_account.desc": "Tài khoản của bạn chưa có vai trò. Vui lòng chọn vai trò để tiếp tục.",
    "home.or_logout": "Hoặc đăng xuất",
    "home.loading": "Đang tải...",
  },
  en: {
    "language.vi": "Vietnamese",
    "language.en": "English",
    "language.de": "German",
    "app.title": "PronunCheck",
    "role.student": "Student",
    "role.teacher": "Teacher",
    "auth.logout": "Logout",
    "auth.login": "Login",
    "auth.register": "Register",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.processing": "Processing...",
    "home.question": "What role do you want to join as?",
    "home.student.desc": "Practice pronunciation, join classes and get instant feedback.",
    "home.teacher.desc": "Create classes, assign tasks and track student progress.",
    "home.update_account": "Update Account",
    "home.update_account.desc": "Your account has no role yet. Please select a role to continue.",
    "home.or_logout": "Or logout",
    "home.loading": "Loading...",
  },
  de: {
    "language.vi": "Vietnamesisch",
    "language.en": "Englisch",
    "language.de": "Deutsch",
    "app.title": "PronunCheck",
    "role.student": "Schüler",
    "role.teacher": "Lehrer",
    "auth.logout": "Abmelden",
    "auth.login": "Anmelden",
    "auth.register": "Registrieren",
    "auth.email": "E-Mail",
    "auth.password": "Passwort",
    "auth.processing": "Bitte warten...",
    "home.question": "Als welche Rolle möchten Sie beitreten?",
    "home.student.desc": "Aussprache üben, an Kursen teilnehmen und sofortiges Feedback erhalten.",
    "home.teacher.desc": "Kurse erstellen, Aufgaben zuweisen und den Fortschritt der Schüler verfolgen.",
    "home.update_account": "Konto aktualisieren",
    "home.update_account.desc": "Ihr Konto hat noch keine Rolle. Bitte wählen Sie eine Rolle, um fortzufahren.",
    "home.or_logout": "Oder abmelden",
    "home.loading": "Wird geladen...",
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("vi");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_language") as Language;
    if (savedLang && (savedLang === "vi" || savedLang === "en" || savedLang === "de")) {
      setLanguageState(savedLang);
    }
    setMounted(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app_language", lang);
  };

  const t = (key: string) => {
    return dictionary[language]?.[key] || key;
  };

  if (!mounted) {
     return <div className="min-h-screen bg-gray-900" />;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
