import React from 'react';
import Footer from '@theme-original/DocItem/Footer';
import VoteWidget from '@site/src/components/VoteWidget';
import styles from './styles.module.css';

export default function FooterWrapper(props) {
  return (
    <div className={styles.row}>
      <VoteWidget />
      <Footer {...props} />
    </div>
  );
}
