import { useAtomValue } from "jotai";
import { languageAtom } from "@/store";

const translations = {
    en: {
        // Sidebar
        Home: "Home",
        Configs: "Configs",
        "DNS Tester": "DNS Tester",
        Settings: "Settings",
        Logs: "Logs",
        "GUI Client for Slipstream": "GUI Client for Slipstream",
        "System Logs": "System Logs",
        "Clear": "Clear",

        // Settings Page
        "Configure global application behavior.": "Configure global application behavior.",
        "Appearance": "Appearance",
        "Language": "Language",
        "Theme": "Theme",
        "Dark": "Dark",
        "Light": "Light",
        "System": "System",
        "Core Behavior": "Core Behavior",
        "Authoritative Mode": "Authoritative Mode",
        "Enforce strict DNS resolution. Only enable if you know what you are doing.": "Enforce strict DNS resolution. Only enable if you know what you are doing.",
        "Local Proxies": "Local Proxies",
        "These ports are exposed on your local machine.": "These ports are exposed on your local machine.",
        "HTTP Proxy": "HTTP Proxy",
        "SOCKS5 Proxy": "SOCKS5 Proxy",
        "Designed with ❤️": "Designed with ❤️",

        // Config Page
        "Manage your VPN connections.": "Manage your VPN connections.",
        "Import": "Import",
        "Export All": "Export All",
        "Copied!": "Copied!",
        "Add Config": "Add Config",
        "No configurations found.": "No configurations found.",
        "Create your first one": "Create your first one",

        // DNS Page
        "Compare DNS resolvers for speed and compatibility.": "Compare DNS resolvers for speed and compatibility.",
        "Setup": "Setup",
        "Configuration": "Configuration",
        "Scan Mode": "Scan Mode",
        "Verify Slipstream": "Verify Slipstream",
        "Verify DNSTT": "Verify DNSTT",
        "Test Domain": "Test Domain",
        "Workers": "Workers",
        "Timeout": "Timeout",
        "DNS Servers (one per line)": "DNS Servers (one per line)",
        "START SCAN": "START SCAN",
        "STOP": "STOP",
        "SCANNING...": "SCANNING...",
        "READY": "READY",
        "Show working only": "Show working only",
        "Server": "Server",
        "Score": "Score",
        "Time": "Time",
        "Details": "Details",
        "Action": "Action",

        // Home Page
        "Download": "Download",
        "Upload": "Upload",
        "System Proxy": "System Proxy",
        "ON": "ON",
        "OFF": "OFF",
        "Add Custom DNS": "Add Custom DNS",
        "Enter a DNS server address (IP:Port).": "Enter a DNS server address (IP:Port).",
        "Cancel": "Cancel",
        "Add": "Add",
        "CONNECT": "CONNECT",
        "Config": "Config",
        "DNS": "DNS",

        // Config Page
        "Configurations": "Configurations",
        "Import Configurations": "Import Configurations",
        "Paste ssgate links (one per line)": "Paste ssgate links (one per line)",
        "Each line should start with ssgate:name// ...": "Each line should start with <code>ssgate:name//</code> followed by base64 data.",
        "Import Configs": "Import Configs",
        "Edit Configuration": "Edit Configuration",
        "New Configuration": "New Configuration",
        "SOCKS5 Auth (Optional)": "SOCKS5 Auth (Optional)",
        "Username": "Username",
        "Password": "Password",
        "Save Config": "Save Config",
        "Delete Configuration?": "Delete Configuration?",
        "Are you sure you want to delete this configuration? This action cannot be undone.": "Are you sure you want to delete this configuration? This action cannot be undone.",
        "Delete": "Delete",
        "Flag": "Flag",
        "Remark": "Remark",
        "Domain": "Domain",
    },
    fa: {
        // Sidebar
        Home: "خانه",
        Configs: "کانفیگ‌ها",
        "DNS Tester": "تست DNS",
        Settings: "تنظیمات",
        Logs: "گزارش‌ها",
        "GUI Client for Slipstream": "رابط کاربری اسلیپ‌استریم",
        "System Logs": "گزارش‌های سیستم",
        "Clear": "پاک کردن",

        // Settings Page
        "Configure global application behavior.": "تنظیم رفتار کلی برنامه.",
        "Appearance": "ظاهر",
        "Language": "زبان",
        "Theme": "تم",
        "Dark": "تاریک",
        "Light": "روشن",
        "System": "سیستم",
        "Core Behavior": "رفتار هسته",
        "Authoritative Mode": "حالت سخت‌گیرانه (Authoritative)",
        "Enforce strict DNS resolution. Only enable if you know what you are doing.": "اجرای دقیق DNS. فقط اگر می‌دانید چه می‌کنید فعال کنید.",
        "Local Proxies": "پراکسی‌های محلی",
        "These ports are exposed on your local machine.": "این پورت‌ها روی دستگاه شما باز هستند.",
        "HTTP Proxy": "پراکسی HTTP",
        "SOCKS5 Proxy": "پراکسی SOCKS5",
        "Designed with ❤️": "طراحی شده با ❤️",

        // Config Page
        "Configurations": "کانفیگ‌ها",
        "Manage your VPN connections.": "مدیریت اتصالات VPN.",
        "Import": "وارد کردن",
        "Export All": "خروجی همه",
        "Copied!": "کپی شد!",
        "Add Config": "افزودن کانفیگ",
        "No configurations found.": "هیچ کانفیگی یافت نشد.",
        "Create your first one": "اولین کانفیگ را بسازید",

        // DNS Page
        "Compare DNS resolvers for speed and compatibility.": "مقایسه DNS سرور ها برای پیدا کردن DNS های سازگار و پرسرعت.",
        "Setup": "راه‌اندازی",
        "Configuration": "پیکربندی",
        "Scan Mode": "حالت اسکن",
        "Verify Slipstream": "بررسی اسلیپ‌استریم",
        "Verify DNSTT": "بررسی DNSTT",
        "Test Domain": "دامین تست",
        "Workers": "ورکرها",
        "Timeout": "زمان انتظار",
        "DNS Servers (one per line)": "سرورهای DNS (در هر خط یکی)",
        "START SCAN": "شروع اسکن",
        "STOP": "توقف",
        "SCANNING...": "در حال اسکن...",
        "READY": "آماده",
        "Show working only": "فقط نمایش سالم‌ها",
        "Server": "سرور",
        "Score": "امتیاز",
        "Time": "زمان",
        "Details": "جزئیات",
        "Action": "عملیات",

        // Home Page
        "Download": "دانلود",
        "Upload": "آپلود",
        "System Proxy": "پراکسی سیستم",
        "ON": "روشن",
        "OFF": "خاموش",
        "Add Custom DNS": "افزودن DNS دلخواه",
        "Enter a DNS server address (IP:Port).": "آدرس سرور DNS را وارد کنید (آی‌پی:پورت).",
        "Cancel": "لغو",
        "Add": "افزودن",
        "CONNECT": "اتصال",
        "Config": "کانفیگ",
        "DNS": "DNS",

        // Config Page
        "Import Configurations": "وارد کردن کانفیگ‌ها",
        "Paste ssgate links (one per line)": "لینک‌های ssgate را اینجا وارد کنید (هر خط یک لینک)",
        "Each line should start with ssgate:name// ...": "هر خط باید با <code>ssgate:name//</code> شروع شود.",
        "Import Configs": "وارد کردن",
        "Edit Configuration": "ویرایش کانفیگ",
        "New Configuration": "کانفیگ جدید",
        "SOCKS5 Auth (Optional)": "احراز هویت SOCKS5 (اختیاری)",
        "Username": "نام کاربری",
        "Password": "رمز عبور",
        "Save Config": "ذخیره کانفیگ",
        "Delete Configuration?": "حذف کانفیگ؟",
        "Are you sure you want to delete this configuration? This action cannot be undone.": "آیا از حذف این کانفیگ اطمینان دارید؟ این عملیات غیرقابل بازگشت است.",
        "Delete": "حذف",
        "Flag": "پرچم",
        "Remark": "نام",
        "Domain": "دامنه",
    }
};

export function useTranslation() {
    const lang = useAtomValue(languageAtom);

    const t = (key: keyof typeof translations['en'] | string) => {
        const dict = translations[lang] || translations['en'];
        return (dict as any)[key] || key;
    };

    return { t, lang, dir: lang === 'fa' ? 'rtl' : 'ltr' };
}
