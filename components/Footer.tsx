import React from "react";

interface FooterProps {
  loading?: boolean;
}

const Footer: React.FC<FooterProps> = ({ loading }) => {
  const year = new Date().getFullYear();

  if (loading) return null;

  return (
    <footer className="max-w-3xl mx-auto px-4 pt-2 pb-8 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
      Made with <span aria-hidden>❤️</span> and Coffee by{" "}
      <a
        href="https://sentack-portfolio.vercel.app"
        target="_blank"
        rel="noreferrer"
        className="font-bold text-black dark:text-white underline decoration-volt decoration-2 underline-offset-4 hover:decoration-[3px]"
      >
        SENTACK
      </a>{" "}
      © {year}
    </footer>
  );
};

export default Footer;