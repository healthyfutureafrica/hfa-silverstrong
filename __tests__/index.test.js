const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('index.html sanity checks', () => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  let content;

  beforeAll(() => {
    content = fs.readFileSync(indexPath, 'utf8');
  });

  test('file exists and is not empty', () => {
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(0);
  });

  test('has a closing </html> element', () => {
    expect(content.toLowerCase()).toContain('</html>');
  });

  test('has a title tag', () => {
    expect(content.toLowerCase()).toMatch(/<title>.*<\/title>/);
  });

  describe('free health assistant disclaimers', () => {
    test('names the assistant SLY in English and French', ()=>{
      expect((content.match(/fh_assistant_title:'SLY'/g)||[])).toHaveLength(2);
    });

    function assistantContext() {
      const context={
        LANG:'en',IC:{warn:'WARNING ICON'},
        t:key=>({fh_assistant_disclaimer_title:'Disclaimer first',fh_assistant_disclaimer_body:'General education, not diagnosis.',fh_assistant_answer_intro:'Reviewed guidance:',fh_assistant_redflags:'Seek care if:',fh_assistant_emergency:'Call emergency services now.',fh_assistant_no_match:'No reviewed match.'}[key]||key),
        FREE_HEALTH_TOPICS:[{keywords:{en:['sore throat']},guidance:{en:['Rest and stay hydrated.']},redFlags:{en:['Seek care if breathing is difficult.']}}],
        NUTRITION_ESSENTIALS:[{text:{en:'Choose balanced meals.'}},{text:{en:'Drink water.'}},{text:{en:'Limit added salt.'}}],
        EXERCISE_ESSENTIALS:[{text:{en:'Start with short, easy walks.'}},{text:{en:'Increase activity gradually.'}},{text:{en:'Stop if you feel unwell.'}}],
        fhL:field=>field?.[context.LANG]??field,
      };
      vm.createContext(context);
      const source=content.match(/^function fhAssistantResponse\([^]*?^}/m);
      expect(source).not.toBeNull();
      vm.runInContext(source[0],context);
      return context;
    }

    test.each([
      ['What should I eat?', 'Choose balanced meals.'],
      ['How do I start exercise?', 'Start with short, easy walks.'],
      ['What can help a sore throat?', 'Rest and stay hydrated.'],
    ])('puts the disclaimer before advice for %s', (question,advice)=>{
      const response=assistantContext().fhAssistantResponse(question);
      expect(response.indexOf('Disclaimer first')).toBeGreaterThanOrEqual(0);
      expect(response.indexOf('Disclaimer first')).toBeLessThan(response.indexOf(advice));
    });

    test.each([
      ['I have chest pain', 'Call emergency services now.'],
      ['Tell me about a topic not covered here', 'No reviewed match.'],
    ])('puts the disclaimer before non-guidance response for %s', (question,message)=>{
      const response=assistantContext().fhAssistantResponse(question);
      expect(response.indexOf('Disclaimer first')).toBeGreaterThanOrEqual(0);
      expect(response.indexOf('Disclaimer first')).toBeLessThan(response.indexOf(message));
    });
  });

  describe('ID document type uploads', () => {
    function uploadContext(role='patient', documentType='passport') {
      const fields = {};
      ['d','n','p'].forEach(suffix => {
        fields['rid-'+suffix] = {id:'rid-'+suffix,files:[{name:'synthetic-id.pdf'}]};
        fields['rid-type-'+suffix] = {value:documentType};
      });
      fields['pf-id'] = {files:[{name:'synthetic-id.pdf'}]};
      fields['pf-id-type'] = {value:documentType};
      fields['pf-id-status'] = {textContent:''};
      fields['rwa'] = {value:'+237 600 000 000'};
      fields['rwa-consent'] = {checked:false};
      const context = {
        RROLE:role, CU:{}, CP:'dashboard', DB:{users:[],consents:[]},
        ApiState:{enabled:false},
        notifyPatientActivity:jest.fn(),
        $:id=>fields[id] || {value:'Synthetic example',checked:true},
        t:key=>key, amsg:jest.fn(), validConsultationFee:()=>true,
        tsNow:()=>'test timestamp', todayD:()=>'2026-10-07', nextHfaId:()=>'test-id',
        log:jest.fn(), goApp:jest.fn(), navigate:jest.fn(), swtTab:jest.fn(), closeMo:jest.fn(),
        FileReader:jest.fn().mockImplementation(() => ({
          readAsDataURL() { this.result='data:application/pdf;base64,dGVzdA=='; this.onload(); }
        })),
      };
      vm.createContext(context);
      ['normalizeWhatsAppNumber','doReg','finishReg','saveIdUpload','idDocumentTypeOptions','idVerificationCard'].forEach(name => {
        const source = content.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'));
        expect(source).not.toBeNull();
        vm.runInContext(source[0], context);
      });
      return {context,fields};
    }

    test.each(['doctor','nurse','patient'])('requires an ID type for %s registration', role => {
      const {context} = uploadContext(role, '');
      context.doReg();
      expect(context.amsg).toHaveBeenCalledWith('id_type_required');
      expect(context.FileReader).not.toHaveBeenCalled();
      expect(context.DB.users).toHaveLength(0);
    });

    test.each(['doctor','nurse','patient'])('stores the selected ID type for %s registration', role => {
      const {context} = uploadContext(role, 'passport');
      context.doReg();
      expect(context.DB.users[0]).toMatchObject({idDocumentType:'passport',idDocumentName:'synthetic-id.pdf',idVerificationStatus:'pending'});
    });

    test.each(['','600000000','+000000000','+237abc000000','+1234567890123456'])('patient registration rejects invalid WhatsApp number %s', number => {
      const {context,fields}=uploadContext();
      fields['rwa'].value=number;
      context.doReg();
      expect(context.amsg).toHaveBeenCalledWith('whatsapp_number_required');
      expect(context.DB.users).toHaveLength(0);
      expect(context.FileReader).not.toHaveBeenCalled();
    });

    test.each([false,true])('patient registration stores normalized WhatsApp number and opt-in %s', consent => {
      const {context,fields}=uploadContext();
      fields['rwa-consent'].checked=consent;
      context.doReg();
      expect(context.DB.users[0]).toMatchObject({whatsappNumber:'+237600000000',whatsappNotificationsConsent:consent,whatsappConsentAt:consent?'test timestamp':null});
    });

    test.each(['','unsupported','drivers_license'])('blocks profile uploads with invalid ID type %s', documentType => {
      const {context,fields} = uploadContext('patient', documentType);
      context.saveIdUpload();
      expect(fields['pf-id-status'].textContent).toBe('id_type_required');
      expect(context.FileReader).not.toHaveBeenCalled();
      expect(context.CU.idDocumentType).toBeUndefined();
    });

    test.each(['national_id','passport'])('saves and displays profile ID type %s', documentType => {
      const {context} = uploadContext('patient', documentType);
      context.CU.idDocumentType = 'passport';
      context.saveIdUpload();
      expect(context.CU).toMatchObject({idDocumentType:documentType,idDocumentName:'synthetic-id.pdf',idVerificationStatus:'pending'});
      expect(context.idVerificationCard()).toContain('id_type_'+documentType);
      expect(context.idDocumentTypeOptions(documentType)).toContain(`value="${documentType}" selected`);
    });

    test('requires a file and leaves the existing ID unchanged', () => {
      const {context,fields} = uploadContext();
      context.CU.idDocumentType = 'national_id';
      fields['pf-id'].files = [];
      context.saveIdUpload();
      expect(fields['pf-id-status'].textContent).toBe('id_required');
      expect(context.CU.idDocumentType).toBe('national_id');
      expect(context.FileReader).not.toHaveBeenCalled();
    });

    test.each(['doctor','nurse','patient'])('rejects driver licenses for %s registration', role => {
      const {context}=uploadContext(role,'drivers_license');
      context.doReg();
      expect(context.amsg).toHaveBeenCalledWith('id_type_required');
      expect(context.FileReader).not.toHaveBeenCalled();
    });

    test('offers only national ID card and passport', () => {
      const {context}=uploadContext();
      const options=context.idDocumentTypeOptions();
      expect(options).toContain('value="national_id"');
      expect(options).toContain('value="passport"');
      expect(options).not.toContain('drivers_license');
      expect(content).not.toContain('id_type_drivers_license');
    });
  });

  test('filters patients by surname initial and sorts by surname', () => {
    const context={};
    vm.createContext(context);
    ['patientSurname','filterPatientsByInitial'].forEach(name=> {
      vm.runInContext(content.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'))[0],context);
    });
    const patients=[{name:'Emmanuel Tabe'},{name:'Joseph Fon'},{name:'Carine Mbeki'},{name:'Jane Doe',lastName:'Émile'}];
    expect(context.filterPatientsByInitial(patients,'F').map(patient=>patient.name)).toEqual(['Joseph Fon']);
    expect(context.filterPatientsByInitial(patients,'E').map(patient=>patient.name)).toEqual(['Jane Doe']);
    expect(context.filterPatientsByInitial(patients,'').map(patient=>patient.name)).toEqual(['Jane Doe','Joseph Fon','Carine Mbeki','Emmanuel Tabe']);
    expect(context.filterPatientsByInitial(patients,'Z')).toHaveLength(0);
  });

  describe('appointment-only calls and future alerts', () => {
    function communicationContext() {
      const doctor={id:'doc1',role:'doctor',name:'Synthetic Doctor'}, patient={id:'pat1',role:'patient',phone:'+237600000000'};
      const appointment={id:'apt-test',doctorId:'doc1',patientId:'pat1',nurseId:'nur1',date:'2030-01-02',time:'10:00',durationMinutes:30,mode:'video',status:'scheduled'};
      const clock={now:new Date('2030-01-02T10:15').getTime()};
      const context={CU:patient,SC:doctor,LANG:'en',DB:{appointments:[appointment],whatsappAlerts:[],notifications:[]},
        ApiState:{enabled:false},
        Date:class extends Date { static now() { return clock.now; } },
        G:id=>id==='doc1'?doctor:id==='pat1'?patient:null,
        t:key=>key,tsNow:()=>'test time',notifyUser:jest.fn(),fetch:jest.fn(),alert:jest.fn(),$:jest.fn(),
        convBetween:()=>[],RCOL:{},ini:()=>'SD',IC:{send:'send'},
      };
      vm.createContext(context);
      ['appointmentCallAllowed','startVC','startVoiceCall','normalizeWhatsAppNumber','queuePatientWhatsAppAlert','notifyUser','notifyPatientActivity','notifyPatientAccountChange','prepareDoctorReplyAlert','chatView'].forEach(name=>{
        vm.runInContext(content.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'))[0],context);
      });
      context.notifyUser=jest.fn(context.notifyUser);
      return {context,doctor,patient,appointment,clock};
    }

    test.each([['09:59',false],['10:00',true],['10:29',true],['10:30',false]])('allows calls at %s only within the scheduled window', (time,allowed)=>{
      const {context,clock}=communicationContext();
      clock.now=new Date('2030-01-02T'+time).getTime();
      expect(context.appointmentCallAllowed('apt-test','doc1','video')).toBe(allowed);
    });

    test('blocks wrong contacts, call modes and participants', ()=>{
      const {context}=communicationContext();
      expect(context.appointmentCallAllowed('apt-test','doc2','video')).toBe(false);
      expect(context.appointmentCallAllowed('apt-test','doc1','voice')).toBe(false);
      context.CU={id:'pat2',role:'patient'};
      expect(context.appointmentCallAllowed('apt-test','doc1','video')).toBe(false);
      context.CU=null;
      expect(context.appointmentCallAllowed('apt-test','doc1','video')).toBe(false);
    });

    test('doctors can call only their appointment patient and completed appointments are blocked', ()=>{
      const {context,doctor,appointment}=communicationContext();
      context.CU=doctor;
      expect(context.appointmentCallAllowed('apt-test','pat1','video')).toBe(true);
      appointment.status='completed';
      expect(context.appointmentCallAllowed('apt-test','pat1','video')).toBe(false);
    });

    test('direct contact calls cannot bypass appointment checks', ()=>{
      const {context}=communicationContext();
      context.startVC('doc1');
      context.startVoiceCall('doc1');
      expect(context.alert).toHaveBeenCalledTimes(2);
      expect(context.$).not.toHaveBeenCalled();
    });

    test('conversation markup has no voice or video call controls', ()=>{
      const {context}=communicationContext();
      const html=context.chatView();
      expect(html).not.toContain('startVC');
      expect(html).not.toContain('startVoiceCall');
      expect(html).toContain('sendMsg()');
    });

    test('doctor replies create unsent generic alerts without clinical text', ()=>{
      const {context}=communicationContext();
      context.prepareDoctorReplyAlert({id:'message-test',from:'doc1',to:'pat1',text:'Synthetic clinical details'});
      expect(context.notifyUser).toHaveBeenCalledWith('pat1','doctor_reply_alert','Communications',{messageId:'message-test',doctorId:'doc1'});
      expect(context.DB.whatsappAlerts[0]).toMatchObject({patientId:'pat1',phone:'+237600000000',status:'integration_pending',requiresConsent:true,template:'doctor_reply_available'});
      expect(JSON.stringify(context.DB.whatsappAlerts)).not.toContain('Synthetic clinical details');
      expect(context.fetch).not.toHaveBeenCalled();
    });

    test('patient activity creates a single automated no-reply alert and login link', ()=>{
      const {context}=communicationContext();
      context.notifyUser('pat1','Synthetic private clinical details','Lab Results',{labResultId:'lab-test'});
      expect(context.DB.notifications).toHaveLength(1);
      expect(context.DB.whatsappAlerts).toHaveLength(1);
      expect(context.DB.whatsappAlerts[0]).toMatchObject({template:'profile_activity_available',message:'patient_activity_no_reply',sender:'HFA SilverStrong',replyAllowed:false,loginUrl:'https://healthyfutureafrica.github.io/hfa-silverstrong/',status:'integration_pending'});
      expect(JSON.stringify(context.DB.whatsappAlerts)).not.toContain('Synthetic private clinical details');
      expect(context.fetch).not.toHaveBeenCalled();
    });

    test.each(['Appointments','Medical Records','Care Notes','Care Coordination','Billing','Home Visits','Urgent Care','Account'])('%s activity generates a generic alert without private data', resource=>{
      const {context}=communicationContext();
      context.notifyPatientActivity('pat1',resource,{notes:'Private clinical content',diagnosis:'Private diagnosis'});
      expect(context.DB.whatsappAlerts).toHaveLength(1);
      expect(context.DB.whatsappAlerts[0]).toMatchObject({message:'patient_activity_no_reply',replyAllowed:false,status:'integration_pending'});
      expect(JSON.stringify(context.DB.whatsappAlerts)).not.toContain('Private');
    });

    test('provider activity does not create a patient WhatsApp alert', ()=>{
      const {context}=communicationContext();
      context.notifyUser('doc1','Provider-only activity','Lab Results');
      expect(context.DB.notifications).toHaveLength(1);
      expect(context.DB.whatsappAlerts).toHaveLength(0);
    });

    test('alerts use the dedicated WhatsApp number and recorded opt-in', ()=>{
      const {context,patient}=communicationContext();
      patient.whatsappNumber='+237 611 111 111';
      patient.whatsappNotificationsConsent=true;
      context.prepareDoctorReplyAlert({id:'message-test',from:'doc1',to:'pat1'});
      expect(context.DB.whatsappAlerts[0]).toMatchObject({phone:'+237611111111',requiresConsent:false,status:'integration_pending'});
    });

    test('account changes prepare generic unsent alerts and in-app notices', ()=>{
      const {context}=communicationContext();
      context.notifyPatientAccountChange('pat1','account_suspended');
      expect(context.notifyUser).toHaveBeenCalledWith('pat1','account_updated_alert','Account',{change:'account_suspended'});
      expect(context.DB.whatsappAlerts[0]).toMatchObject({template:'account_update_available',change:'account_suspended',requiresConsent:true,status:'integration_pending'});
      expect(context.fetch).not.toHaveBeenCalled();
    });

    test('missing phone still produces an in-app notice but no WhatsApp record', ()=>{
      const {context,patient}=communicationContext();
      patient.phone='';
      context.prepareDoctorReplyAlert({id:'message-test',from:'doc1',to:'pat1'});
      expect(context.notifyUser).toHaveBeenCalled();
      expect(context.DB.whatsappAlerts).toHaveLength(0);
    });

    test('patient replies do not queue doctor-to-patient alerts', ()=>{
      const {context}=communicationContext();
      context.prepareDoctorReplyAlert({id:'message-test',from:'pat1',to:'doc1'});
      expect(context.notifyUser).not.toHaveBeenCalled();
      expect(context.DB.whatsappAlerts).toHaveLength(0);
    });
  });

  describe('doctor photo moderation', () => {
    function photoContext() {
      const doctor={id:'doc1',role:'doctor',name:'Synthetic Doctor'};
      const fields={'doctor-photo-file':{files:[{type:'image/png',size:1000}]},'doctor-photo-status':{textContent:''}};
      const canvas={getContext:()=>({drawImage:jest.fn()}),toDataURL:()=>'data:image/jpeg;base64,dGVzdA=='};
      const context={CU:doctor,G:()=>doctor,$:id=>fields[id],t:key=>key,tsNow:()=>'test time',log:jest.fn(),navigate:jest.fn(),closeMo:jest.fn(),buildSidebar:jest.fn(),CP:'dashboard',
        document:{createElement:()=>canvas},
        Image:class { constructor() { this.naturalWidth=960;this.naturalHeight=720; } set src(value) { this.onload(); } },
        FileReader:jest.fn().mockImplementation(()=>({readAsDataURL() { this.result='data:image/png;base64,dGVzdA==';this.onload(); }})),
      };
      vm.createContext(context);
      ['approvedDoctorPhoto','saveDoctorPhoto','reviewDoctorPhoto'].forEach(name=>{
        vm.runInContext(content.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'))[0],context);
      });
      return {context,doctor,fields,canvas};
    }

    test('resizes the upload and keeps it hidden until admin approval', ()=>{
      const {context,doctor,canvas}=photoContext();
      context.saveDoctorPhoto();
      expect(canvas.width).toBe(480);
      expect(canvas.height).toBe(360);
      expect(doctor.doctorPhotoSubmission.status).toBe('pending');
      expect(context.approvedDoctorPhoto(doctor)).toBeNull();
      context.CU={id:'adm1',role:'admin'};
      context.reviewDoctorPhoto(doctor.id,true);
      expect(context.approvedDoctorPhoto(doctor)).toBe('data:image/jpeg;base64,dGVzdA==');
      expect(doctor.doctorPhoto.reviewedBy).toBe('adm1');
    });

    test('doctors cannot approve their own picture', ()=>{
      const {context,doctor}=photoContext();
      context.saveDoctorPhoto();
      context.reviewDoctorPhoto(doctor.id,true);
      expect(doctor.doctorPhotoSubmission.status).toBe('pending');
      expect(context.approvedDoctorPhoto(doctor)).toBeNull();
    });

    test('rejected replacement retains the previously approved portrait', ()=>{
      const {context,doctor}=photoContext();
      doctor.doctorPhoto={status:'approved',data:'data:image/jpeg;base64,b2xk'};
      context.saveDoctorPhoto();
      expect(context.approvedDoctorPhoto(doctor)).toBe('data:image/jpeg;base64,b2xk');
      context.CU={id:'adm1',role:'admin'};
      context.reviewDoctorPhoto(doctor.id,false);
      expect(doctor.doctorPhotoSubmission.status).toBe('rejected');
      expect(context.approvedDoctorPhoto(doctor)).toBe('data:image/jpeg;base64,b2xk');
    });

    test.each([{type:'image/svg+xml',size:100},{type:'image/png',size:3*1024*1024}])('rejects unsupported or oversized files %j', file=>{
      const {context,doctor,fields}=photoContext();
      fields['doctor-photo-file'].files=[file];
      context.saveDoctorPhoto();
      expect(fields['doctor-photo-status'].textContent).toBe('photo_file_required');
      expect(context.FileReader).not.toHaveBeenCalled();
      expect(doctor.doctorPhotoSubmission).toBeUndefined();
    });

    test('patient accounts cannot upload doctor pictures', ()=>{
      const {context}=photoContext();
      context.CU={id:'pat1',role:'patient'};
      context.saveDoctorPhoto();
      expect(context.FileReader).not.toHaveBeenCalled();
    });
  });

  describe('appointment rescheduling', () => {
    function rescheduleContext(role='patient') {
      const appointment={id:'apt-test',patientId:'pat1',doctorId:'doc1',date:'2030-01-02',time:'10:00',durationMinutes:30,status:'scheduled'};
      const fields={'rs-date':{value:'2030-01-03'},'rs-time':{value:'11:00'},'rs-duration':{value:'45'},'rs-reason':{value:'Synthetic emergency'},'rs-method':{value:'card'},'rs-status':{textContent:''},'rs-confirm':{disabled:false}};
      const payment={};
      ['from','amount','currency','purpose','method','meta'].forEach(name=>{payment[name]=jest.fn().mockReturnValue(payment);});
      payment.process=jest.fn().mockResolvedValue({id:'pay-test',status:'completed'});
      const context={
        $:id=>fields[id],t:key=>key,CU:{id:role==='doctor'?'doc1':'pat1',role},DB:{appointments:[appointment]},
        notifyPatientActivity:jest.fn(),
        ReschedulePolicy:{patientFee:5,currency:'USD'},Payment:{create:jest.fn().mockReturnValue(payment)},
        Date:class extends Date { static now() { return new Date('2030-01-01T00:00').getTime(); } },
        tsNow:()=>'test time',log:jest.fn(),closeMo:jest.fn(),navigate:jest.fn(),CP:'appointments',
      };
      vm.createContext(context);
      ['canRescheduleAppointment','appointmentScheduleError','confirmReschedule'].forEach(name=>{
        vm.runInContext(content.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^}`, 'm'))[0],context);
      });
      return {context,appointment,fields,payment};
    }

    test('charges patients USD 5 and records the reschedule history', async()=>{
      const {context,appointment,payment}=rescheduleContext();
      await context.confirmReschedule(appointment.id);
      expect(payment.amount).toHaveBeenCalledWith(5);
      expect(payment.currency).toHaveBeenCalledWith('USD');
      expect(appointment).toMatchObject({date:'2030-01-03',time:'11:00',durationMinutes:45});
      expect(appointment.reschedules[0]).toMatchObject({previousDate:'2030-01-02',fee:5,paymentId:'pay-test',requestedRole:'patient'});
      expect(context.canRescheduleAppointment(appointment)).toBe(true);
    });

    test('doctor rescheduling is free', async()=>{
      const {context,appointment}=rescheduleContext('doctor');
      await context.confirmReschedule(appointment.id);
      expect(context.Payment.create).not.toHaveBeenCalled();
      expect(appointment.reschedules[0]).toMatchObject({fee:0,paymentId:null,requestedRole:'doctor'});
    });

    test.each(['failed','rejected'])('payment %s preserves the appointment and releases the reservation', async result=>{
      const {context,appointment,payment,fields}=rescheduleContext();
      if (result==='failed') payment.process.mockResolvedValue({status:'failed'});
      else payment.process.mockRejectedValue(new Error('Synthetic failure'));
      await context.confirmReschedule(appointment.id);
      expect(appointment.date).toBe('2030-01-02');
      expect(appointment.reschedules).toBeUndefined();
      expect(appointment.rescheduleReservation).toBeUndefined();
      expect(fields['rs-status'].textContent).toBe('payment_failed');
    });

    test('blocks another patient from rescheduling', async()=>{
      const {context,appointment}=rescheduleContext();
      context.CU.id='pat2';
      await context.confirmReschedule(appointment.id);
      expect(context.Payment.create).not.toHaveBeenCalled();
      expect(appointment.date).toBe('2030-01-02');
    });

    test('blocks conflicting reschedules before payment', async()=>{
      const {context,appointment,fields}=rescheduleContext();
      context.DB.appointments.push({id:'other',patientId:'pat2',doctorId:'doc1',date:'2030-01-03',time:'11:15',durationMinutes:30,status:'scheduled'});
      await context.confirmReschedule(appointment.id);
      expect(fields['rs-status'].textContent).toBe('booking_conflict');
      expect(context.Payment.create).not.toHaveBeenCalled();
    });

    test('reserves the new slot and prevents duplicate payment while processing', async()=>{
      const {context,appointment,payment}=rescheduleContext();
      let finishPayment;
      payment.process.mockReturnValue(new Promise(resolve=>{finishPayment=resolve;}));
      const pending=context.confirmReschedule(appointment.id);
      expect(context.appointmentScheduleError('pat2','doc1','2030-01-03','11:15',30)).toBe('booking_conflict');
      await context.confirmReschedule(appointment.id);
      expect(payment.process).toHaveBeenCalledTimes(1);
      finishPayment({id:'pay-test',status:'completed'});
      await pending;
      expect(appointment.rescheduleReservation).toBeUndefined();
    });
  });

  describe('consultation scheduling', () => {
    function bookingContext() {
      const fields = {};
      const values = {'bk-d':'2030-01-02','bk-t2':'10:00','bk-duration':'30','bk-n':'Synthetic consultation',
        'ap-p':'pat1','ap-dt':'2030-01-02','ap-tm':'10:00','ap-duration':'30','ap-md':'video','ap-ty':'consultation','ap-nt':'Synthetic consultation'};
      Object.entries(values).forEach(([id,value]) => { fields[id]={value}; });
      fields['bk-error']={textContent:''};
      fields['ap-error']={textContent:''};
      const context = {
        $:id=>fields[id], t:key=>key, G:()=>({assignedNurse:'nur1'}),
        notifyPatientActivity:jest.fn(),
        CU:{id:'pat1',role:'patient',assignedDoctor:null}, BOOKDOC:'doc1', APTMODE:'video', APTSERVICE:'PC-VIRTUAL', CP:'appointments',
        DB:{appointments:[]}, VIRTUAL_SERVICES:[{code:'PC-VIRTUAL',name:'Virtual primary care'}],
        Date:class extends Date { static now() { return new Date('2030-01-01T00:00').getTime(); } },
        log:jest.fn(), closeMo:jest.fn(), navigate:jest.fn(),
      };
      vm.createContext(context);
      ['appointmentScheduleError','saveBooking','saveApt'].forEach(name => {
        const source=content.match(new RegExp(`^function ${name}\\([^]*?^}`, 'm'));
        expect(source).not.toBeNull();
        vm.runInContext(source[0], context);
      });
      return {context,fields};
    }

    test.each([['patient',30],['patient',45],['doctor',30],['doctor',45]])('%s booking stores a %i-minute consultation', (role,duration) => {
      const {context,fields}=bookingContext();
      if (role==='doctor') {
        context.CU={id:'doc1',role:'doctor'};
        fields['ap-duration'].value=String(duration);
        context.saveApt();
      } else {
        fields['bk-duration'].value=String(duration);
        context.saveBooking();
      }
      expect(context.DB.appointments[0]).toMatchObject({patientId:'pat1',doctorId:'doc1',date:'2030-01-02',time:'10:00',durationMinutes:duration,status:'scheduled'});
      expect(context.notifyPatientActivity).toHaveBeenCalledWith('pat1','Appointments');
      expect(context.closeMo).toHaveBeenCalled();
    });

    test.each(['patient','doctor'])('%s booking requires an explicit duration', role => {
      const {context,fields}=bookingContext();
      if (role==='doctor') {
        context.CU={id:'doc1',role:'doctor'};
        fields['ap-duration'].value='';
        context.saveApt();
      } else {
        fields['bk-duration'].value='';
        context.saveBooking();
      }
      expect(fields[role==='doctor'?'ap-error':'bk-error'].textContent).toBe('duration_required');
      expect(context.DB.appointments).toHaveLength(0);
      expect(context.closeMo).not.toHaveBeenCalled();
      if (role==='patient') expect(context.CU.assignedDoctor).toBeNull();
    });

    test.each([
      ['', '10:00',30,'booking_required'],
      ['2030-01-02','',30,'booking_required'],
      ['2029-12-31','10:00',30,'booking_future'],
      ['2030-01-01','00:00',30,'booking_future'],
      ['2030-02-30','10:00',30,'booking_future'],
      ['2030-01-02','25:00',30,'booking_future'],
      ['2030-01-02','10:00',60,'duration_required'],
    ])('validates date %s, time %s and duration %i', (date,time,duration,error) => {
      const {context}=bookingContext();
      expect(context.appointmentScheduleError('pat1','doc1',date,time,duration)).toBe(error);
    });

    test.each([
      ['pat2','doc1','10:15',30,'booking_conflict'],
      ['pat1','doc2','10:15',30,'booking_conflict'],
      ['pat1','doc1','09:45',30,'booking_conflict'],
      ['pat1','doc1','09:30',30,''],
      ['pat1','doc1','10:45',30,''],
      ['pat2','doc2','10:00',45,''],
    ])('checks full time intervals for patient %s and doctor %s at %s', (patientId,doctorId,time,duration,error) => {
      const {context}=bookingContext();
      context.DB.appointments.push({patientId:'pat1',doctorId:'doc1',date:'2030-01-02',time:'10:00',durationMinutes:45,status:'scheduled'});
      expect(context.appointmentScheduleError(patientId,doctorId,'2030-01-02',time,duration)).toBe(error);
    });

    test('checks overlap across midnight and ignores cancelled appointments', () => {
      const {context}=bookingContext();
      const existing={patientId:'pat1',doctorId:'doc1',date:'2030-01-02',time:'23:45',durationMinutes:45,status:'scheduled'};
      context.DB.appointments.push(existing);
      expect(context.appointmentScheduleError('pat2','doc1','2030-01-03','00:15',30)).toBe('booking_conflict');
      existing.status='cancelled';
      expect(context.appointmentScheduleError('pat2','doc1','2030-01-03','00:15',30)).toBe('');
    });

    test('prevents conflicting bookings without changing doctor assignment', () => {
      const {context,fields}=bookingContext();
      context.DB.appointments.push({patientId:'pat2',doctorId:'doc1',date:'2030-01-02',time:'10:00',durationMinutes:45,status:'scheduled'});
      context.saveBooking();
      expect(fields['bk-error'].textContent).toBe('booking_conflict');
      expect(context.DB.appointments).toHaveLength(1);
      expect(context.CU.assignedDoctor).toBeNull();
      expect(context.closeMo).not.toHaveBeenCalled();
    });
  });

  test('shows the HFA copyright and abbreviated creator signature on the app and language picker', () => {
    expect(content).toContain('<footer class="creator-credit" aria-label="App creator">');
    expect(content).toContain('class="creator-credit creator-credit--picker"');
    expect((content.match(/class="creator-label">&copy; Healthy Future Africa \(HFA\)/g) || []).length).toBe(2);
    expect((content.match(/class="creator-name">Chinjie S\. N\./g) || []).length).toBe(2);
  });

  test('includes the patient provider rating section', () => {
    expect(content).toContain('Rate Your Care Team');
    expect(content).toContain('function renderProviderRatings');
    expect(content).toContain('function saveRating');
    expect(content).toContain('name="provider-rating"');
  });

  test('includes expanded doctor specialties', () => {
    expect(content).toContain('<option>Physiotherapy</option>');
    expect(content).toContain('<option>Psychiatry</option>');
    expect(content).toContain('<option>Clinical Psychology</option>');
    expect(content).toContain("const SPECIALTIES = [");
    expect(content).toContain("'Mental Health'");
    expect(content).toContain('id="rsp" required');
  });

  test('includes nursing specialties across nurse onboarding and profiles', () => {
    expect(content).toContain('id="rns"');
    expect(content).toContain('Psychiatric and Mental Health Nursing');
    expect(content).toContain('const NURSE_SPECIALTIES = [');
    expect(content).toContain('id="au-ns"');
    expect(content).toContain("specialty:$('rns').value");
    expect(content).toContain('id="rns" required');
    expect(content).toContain("Please select your medical specialty.");
    expect(content).toContain("Please select your nursing specialty.");
  });

  test('includes standards-aware virtual care data', () => {
    expect(content).toContain("system:'ICD-10-CM'");
    expect(content).toContain("system:'LOINC'");
    expect(content).toContain("system:'RxNorm'");
    expect(content).toContain('const VIRTUAL_SERVICES = [');
    expect(content).toContain("code:'MENTAL-VIRTUAL'");
    expect(content).toContain("code:'PHYSIO-VIRTUAL'");
    expect(content).toContain("encounterClass:'VR'");
    expect(content).toContain('function showBookApt(serviceCode=');
  });

  test('includes patient safety and longitudinal care workflows', () => {
    expect(content).toContain('function showTriage');
    expect(content).toContain('function submitTriage');
    expect(content).toContain('triageCases: []');
    expect(content).toContain('function renderCarePlan');
    expect(content).toContain('carePlans: [');
    expect(content).toContain('Call your local emergency number');
  });

  test('includes multi-admin governance controls', () => {
    expect(content).toContain("id:'adm2',role:'admin'");
    expect(content).toContain("id:'mgr-a',l:'Administrators'");
    expect(content).toContain('function renderAdminControl');
    expect(content).toContain('function renderIntegrations');
    expect(content).toContain('function renderTriageQueue');
    expect(content).toContain('function renderSafety');
    expect(content).toContain("role==='admin'?{adminRole:");
  });

  test('keeps demo credentials inside the admin portal only', () => {
    expect(content).not.toContain('<strong>Demo Credentials</strong>');
    expect(content).toContain('Testing Access');
    expect(content).toContain('Admin-only demo credentials');
    expect(content).toContain("DB.users.filter(u=>['admin','doctor','nurse','patient','labtech'].includes(u.role))");
    expect(content).toContain('${renderDemoCredentials()}');
  });

  test('provisions Chinjie as the Super Admin', () => {
    expect(content).toContain("email:'chinjiesylvestern@gmail.com'");
    expect(content).toContain("adminRole:'Super Admin'");
    expect(content).toContain("permissions:['all']");
  });

  test('uses the HFA logo asset across the app', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'assets', 'hfa-logo.svg'))).toBe(true);
    expect((content.match(/assets\/hfa-logo\.svg/g) || []).length).toBe(4);
    expect(content).toContain('alt="HFA SilverStrong logo"');
  });

  test('provides a public non-admin demo entry point', () => {
    expect(content).toContain('onclick="startDemo(\'patient\')"');
    expect(content).toContain("function startDemo(role='patient')");
    expect(content).toContain("user.role===role&&user.status==='active'");
  });

  test('includes bilingual legal privacy and confidentiality pages', () => {
    expect(content).toContain('function renderCompliance');
    expect(content).toContain('function renderPrivacy');
    expect(content).toContain('function renderConfidentiality');
    expect(content).toContain('Cameroon Law No. 2010/012');
    expect(content).toContain('GDPR-Aligned Architecture');
    expect(content).toContain('ANTIC Registration');
    expect(content).toContain('Right to Rectification');
    expect(content).toContain('Medical Records');
    expect(content).toContain('10 yr');
    expect(content).toContain('Medical secrecy is a professional and criminal obligation under Cameroon law');
    expect(content).toContain("log('INCIDENT_REPORT'");
    expect(content).toContain("log('CONFIDENTIALITY_PLEDGE'");
    expect(content).toContain("incident_report_action:'Signalement d\\'incident'");
    expect(content).toContain("confidentiality_pledge_action:'Engagement de confidentialité'");
  });

  test('keeps Compliance Centre out of patient navigation', () => {
    const patientNavigation = content.match(/  patient:\[([\s\S]*?)\r?\n  \],\r?\n};/);

    expect(patientNavigation?.[1]).toBeDefined();
    expect(patientNavigation?.[1]).not.toContain("id:'compliance'");
    expect(content).toContain("{id:'compliance',l:()=>t('compliance_nav'),i:'shield'}");
  });

  test('starts at language choice and lets users choose again', () => {
    expect(content).toContain("LANG_RETURN_SCREEN = 'land'");
    expect(content).toContain('function openLangPicker');
    expect(content).toContain('function restoreAfterLanguageChoice');
    expect(content).toContain("show('lang-pick')");
    expect(content).toContain('id="lnd-lang"');
    expect(content).toContain('id="auth-lang-btn"');
    expect(content).toContain('id="fh-lang"');
    expect(content).toContain('id="slb-pick"');
  });
});
