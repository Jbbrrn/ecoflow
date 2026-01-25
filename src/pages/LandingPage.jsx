import { useState } from 'react';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import AboutSection from '../components/AboutSection';
import ProcessSection from '../components/ProcessSection';
import Footer from '../components/Footer';
import LoginModal from '../components/LoginModal';

const LandingPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="landing-page">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-[10000] focus:bg-eco-green-primary focus:text-white focus:px-8 focus:py-4 focus:rounded-br-lg"
      >
        Skip to main content
      </a>

      <Header onLoginClick={() => setIsLoginModalOpen(true)} />
      <HeroSection />
      <main id="main-content">
        <FeaturesSection />
        <AboutSection />
        <ProcessSection />
      </main>
      <Footer />
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
};

export default LandingPage;
