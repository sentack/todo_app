import React from "react";

interface FooterProps {
  loading?: boolean;
}

const Footer: React.FC<FooterProps> = ({ loading }) => {
  const year = new Date().getFullYear();

  if (loading) return null;

  return (
    <footer className="border-t border-gray-200 dark:border-gray-900 py-3 px-4 text-center text-sm text-black dark:text-white">
      Made with <span aria-hidden>❤️</span> and Coffee by{" "}
      <a
        href="https://sentack-portfolio.vercel.app"
        target="_blank"
        rel="noreferrer"
        className="font-semibold hover:underline"
      >
        SENTACK
      </a>{" "}
      © {year}
    </footer>
  );
};

export default Footer;