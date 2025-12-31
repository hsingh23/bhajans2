// @ts-nocheck
import React from "react";
import { Box, Typography, Paper, Container } from "@mui/material";
import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Privacy Policy
        </Typography>
        
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Last updated: December 2024
        </Typography>

        <Box sx={{ mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            Introduction
          </Typography>
          <Typography paragraph>
            Sing With Amma (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) respects your privacy and is committed to protecting your personal data.
            This privacy policy explains how we collect, use, and safeguard your information when you use our bhajan search application.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Information We Collect
          </Typography>
          <Typography paragraph>
            <strong>Account Information:</strong> When you create an account, we collect your email address for authentication purposes.
          </Typography>
          <Typography paragraph>
            <strong>Usage Data:</strong> We collect information about how you use the app, including search queries and favorite bhajans, to improve your experience.
          </Typography>
          <Typography paragraph>
            <strong>Device Information:</strong> We may collect device-specific information for analytics and to ensure proper app functionality.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            How We Use Your Information
          </Typography>
          <Typography paragraph>
            We use your information to:
          </Typography>
          <ul>
            <li><Typography>Provide and maintain the service</Typography></li>
            <li><Typography>Process payments for subscriptions</Typography></li>
            <li><Typography>Sync your favorites across devices</Typography></li>
            <li><Typography>Send important updates about the service</Typography></li>
          </ul>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Data Storage
          </Typography>
          <Typography paragraph>
            Your data is stored securely using Firebase, a Google Cloud service. We implement appropriate security measures to protect your personal information.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Third-Party Services
          </Typography>
          <Typography paragraph>
            We use the following third-party services:
          </Typography>
          <ul>
            <li><Typography>Firebase (Authentication, Database)</Typography></li>
            <li><Typography>PayPal (Payment processing)</Typography></li>
            <li><Typography>Google Analytics (Usage analytics)</Typography></li>
          </ul>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Your Rights
          </Typography>
          <Typography paragraph>
            You have the right to access, correct, or delete your personal data. Contact us at the email below to exercise these rights.
          </Typography>

          <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
            Contact Us
          </Typography>
          <Typography paragraph>
            For questions about this privacy policy, please contact us through MA Center.
          </Typography>

          <Box sx={{ mt: 4, textAlign: "center" }}>
            <Link to="/" style={{ color: "inherit" }}>
              ← Back to Home
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Privacy;
