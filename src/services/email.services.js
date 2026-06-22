require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Error connecting to email server:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});


// Function to send email
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Backend-ledger" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error sending email:', error);
  }
};


async function sendRegistrationEmail(useremail,name){
    const subject="welcome to backend-ledger"
    const text=`Hi ${name},\n\nThank you for registering with backend-ledger! We're excited to have you on board.\n\nBest regards,\nThe backend-ledger Team`
    const html=`<p>Hi ${name},</p><p>Thank you for registering with backend-ledger! We're excited to have you on board.</p><p>Best regards,<br>The backend-ledger Team</p>`
    await sendEmail(useremail,subject,text,html)
}


async function sendTransactionEmail(useremail,name,amount,type){
  const subject="Transaction successful";
  const text=`Hi ${name},\n\nYour transaction of amount ${amount} has been successfully processed as a ${type}.\n\nBest regards,\nThe backend-ledger Team`
  const html=`<p>Hi ${name},</p><p>Your transaction of amount ${amount} has been successfully processed as a ${type}.</p><p>Best regards,<br>The backend-ledger Team</p>`

  await sendEmail(useremail,subject,text,html)

}

async function sendtransactionFailureEmail(useremail,name,amount,type){
  const subject="Transaction Failed";
  const text=`Hi ${name},\n\nWe regret to inform you that your transaction of amount ${amount} as a ${type} has failed. Please try again later or contact support for assistance.\n\nBest regards,\nThe backend-ledger Team`
  const html=`<p>Hi ${name},</p><p>We regret to inform you that your transaction of amount ${amount} as a ${type} has failed. Please try again later or contact support for assistance.</p><p>Best regards,<br>The backend-ledger Team</p>`

  await sendEmail(useremail,subject,text,html)
}


module.exports = {
  sendRegistrationEmail,
  sendTransactionEmail,
  sendtransactionFailureEmail

};
