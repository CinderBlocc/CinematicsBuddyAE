//Written by: SwiFT EQ and CinderBlock
//Version 1.0
//Compatible with Cinematics Buddy version 0.9.9

/*

	TODO:
		- Progress bar seems to lag behind and freeze up, then magically finish the process
			- Make progress bar less intensive so it can keep up with script execution
				- Update every 5 or 10 steps?
				- Reduce number of "TheWindow.update()" calls

		- Fix wheel formatting

		- Add all CarsSeen as null objects
			- Similar to Maxscript, if the car doesn't have animation for that frame, set it to 0,0,0 in both location and rotation
                - Maybe also set it's opacity to 0 while it's in an invalid state? Then people could wire their effects to the opacity track
                - Probably should initialize the whole array of car animations to null first, then give proper values if the keyframe exists for that car
*/

// GLOBAL VARIABLES //
ProgressDialog();
var BlueColor = [0.35, 0.45, 0.9];
var OrangeColor = [0.95, 0.55, 0.2];

// RUN THE SCRIPT //
main();

// PROGRESS DIALOG DEFINITION //
function ProgressDialog()
{    
    var TheWindow;
    var MainLabel;
    var MainBar;
    var SubLabel;
    var SubBar;
    var CancelButton;

    //Create the dialog box
    TheWindow = new Window("palette", "Progress", undefined, {closeButton: true});
    
    //Create the label and progress bar for the main steps
    MainLabel = TheWindow.add("statictext");
    MainLabel.preferredSize = [450, -1];
    MainBar = TheWindow.add("progressbar", undefined, 0, 5);
    MainBar.preferredSize = [450, -1];

    //Create the label and progress bar for the sub steps
    //SubBar is defaulted to 100 steps, but should be set using SetSubSteps
    SubLabel = TheWindow.add("statictext");
    SubLabel.preferredSize = [450, -1];
    SubBar = TheWindow.add("progressbar", undefined, 0, 100);
    SubBar.preferredSize = [450, -1];

    // MEMBER FUNCTIONS //
    ProgressDialog.IncrementMain = function()
    {
        ++MainBar.value;
        SubBar.value = 0;
        SubLabel.text = "";
        TheWindow.update();
    };

    ProgressDialog.IncrementSub = function()
    {
        ++SubBar.value;
        TheWindow.update();
    };

    ProgressDialog.MainMessage = function(message)
    {
        MainLabel.text = message;
        TheWindow.update();
    };

    ProgressDialog.SubMessage = function(message)
    {
        SubLabel.text = message;
        TheWindow.update();
    };

    ProgressDialog.SetMainMaxValue = function(MainSteps)
    {
        MainBar.maxvalue = MainSteps;
        TheWindow.update();
    }

    ProgressDialog.SetSubMaxValue = function(SubSteps)
    {
        SubBar.maxvalue = SubSteps;
        SubBar.value = 0;
        TheWindow.update();
    }

    ProgressDialog.Show = function()
    {
        TheWindow.show();
        TheWindow.update();
    }

    ProgressDialog.Close = function()
    {
        MainLabel.text = "";
        MainBar.value = 0;
        SubLabel.text = "";
        SubBar.value = 0;
        TheWindow.update();
        TheWindow.close();
    };
}
//

// MAIN FUNCTIONS //
function main()
{
    //Make sure there is an active composition
    if(app.project.activeItem == null)
    {
        alert("No selected composition");
        return;
    }
    
    //Create the FileData object. Contains all lines from file, and current line index
    var FileData = GetFileData();
    if(FileData.bSuccess == true)
    {
        //Initialize progress dialog. Currently 5 main steps as denoted by the functions below
        ProgressDialog.SetMainMaxValue(5);
        ProgressDialog.Show();
        
        //Collect header metadata
        var HeaderData = GetHeaderData(FileData.HeaderString);
        
        //Collect keyframes as chunks of strings
        var KeyframeStrings = SplitKeyframes(FileData.KeyframeStrings, parseInt(HeaderData.RecordingMetadata.Frames));

        //Collect arrays of keyframe data, starting from current line index in FileData
        var Keyframes = GetKeyframes(KeyframeStrings);
        
        //Compile all of the keyframes into individual arrays
        var Arrays = GetKeyframeArrays(Keyframes);
        
        //Create camera and layers and apply keyframe data
        ApplyKeyframes(Arrays, HeaderData);
        
        //Return version number upon successful completion
        ProgressDialog.Close();
        return "Version: " + HeaderData.RecordingMetadata.Version;
    }

    return "Failed to open txt file";
}

function GetFileData()
{
    //Create object to return later
    var FileData = new Object();
    FileData.bSuccess = false;
    FileData.HeaderString = new Object();
    FileData.KeyframeStrings = new Object();

    //Get user's file selection
    var ChosenFile = File.openDialog("Choose a Cinematics Buddy export file");

    //Read the file, then close it
    var TheData = new Object();
    if(ChosenFile && ChosenFile.open("r"))
    {
        TheData = ChosenFile.read();        
        ChosenFile.close();
    }
    else
    {
        //File was either not selected or unable to be opened
        alert("Invalid file");
        return FileData;
    }

    //Convert data into a string and split between header and keyframes
    var AsString = TheData.toString();
    var HeaderSubstringEnd = AsString.indexOf("\n", AsString.indexOf("BEGIN ANIMATION"));
    FileData.HeaderString = AsString.substring(0, HeaderSubstringEnd);
    FileData.KeyframeStrings = AsString.substring(HeaderSubstringEnd);
    
    //Successfully completed file read
    FileData.bSuccess = true;
    return FileData;
}

function GetHeaderData(TheHeader)
{
    ProgressDialog.MainMessage("Parsing header");
    ProgressDialog.SetSubMaxValue(3);
    
    //Initialize HeaderData object
    var HeaderData = new Object();
    HeaderData.Lines = TheHeader.split("\n");
    HeaderData.CurrentLine = 0;
    
    //Get RecordingMetadata
    ProgressDialog.SubMessage("Getting Recording Metadata");
    HeaderData.RecordingMetadata = GetRecordingMetadata(HeaderData);
    ProgressDialog.IncrementSub();
    
    //Get ReplayMetadata
    ProgressDialog.SubMessage("Getting Replay Metadata");
    HeaderData.ReplayMetadata = GetReplayMetadata(HeaderData);
    ProgressDialog.IncrementSub();
    
    //Get CarsSeen
    ProgressDialog.SubMessage("Getting Cars Seen");
    HeaderData.CarsSeen = GetCarsSeen(HeaderData);
    ProgressDialog.IncrementSub();
    
    ProgressDialog.IncrementMain();
    return HeaderData;
}

function SplitKeyframes(InString, TotalKeyframes)
{
    ProgressDialog.MainMessage("Splitting keyframes");
    ProgressDialog.SetSubMaxValue(TotalKeyframes);
    ProgressDialog.SubMessage("0/" + TotalKeyframes);
    
    var KeyframeStrings = [];
    var IdxStart = 0;
    var IdxEnd = 0;
    
    //Split all keyframes into separate substrings
    var bIsSplitting = true;
    var bHaveKeyframe = false;
    var StackLevel = 0;
    var KeyframesFound = 0;
    while(bIsSplitting === true)
    {
        ++IdxEnd;
        if(IdxEnd >= InString.length)
        {
            IdxEnd = InString.length;
            bIsSplitting = false;
        }
        
        //Stack match braces until a full keyframe is found
        if(InString[IdxEnd] === '{')
        {
            ++StackLevel;
        }
        else if(InString[IdxEnd] === '}')
        {
            --StackLevel;
            if(StackLevel === 0)
            {
                bHaveKeyframe = true;
            }
        }
        
        //Put the whole keyframe into a substring and push to the array
        if(bHaveKeyframe === true)
        {
            ++KeyframesFound;
            ProgressDialog.IncrementSub();
            ProgressDialog.SubMessage(KeyframesFound + "/" + TotalKeyframes);
            
            //Increment the end to get the last closing brace
            ++IdxEnd;
            KeyframeStrings.push(InString.substring(IdxStart, IdxEnd));
            
            IdxStart = IdxEnd + 1;
            if(IdxStart >= InString.length)
            {
                break;
            }
        }
        
        bHaveKeyframe = false;
    }

    ProgressDialog.IncrementMain();
    return KeyframeStrings;
}

function GetKeyframes(KeyframeStrings)
{
    ProgressDialog.MainMessage("Parsing keyframes");
    ProgressDialog.SetSubMaxValue(KeyframeStrings.length);
    ProgressDialog.SubMessage("0/" + KeyframeStrings.length);
    
    var Keyframes = [];
    
    for(var i = 0; i < KeyframeStrings.length;)
    {        
        Keyframes.push(GetKeyframeData(KeyframeStrings[i]));
        
        ++i;
        ProgressDialog.IncrementSub();
        ProgressDialog.SubMessage(i + "/" + KeyframeStrings.length);
    }

    ProgressDialog.IncrementMain();
    return Keyframes;
}

function GetKeyframeArrays(Keyframes)
{
    ProgressDialog.MainMessage("Compiling keyframes");
    ProgressDialog.SetSubMaxValue(Keyframes.length);
    ProgressDialog.SubMessage("0/" + Keyframes.length);
    
    var Arrays = [];
    
    //Time array
    Arrays.Time = [];
    
    //Camera arrays
    Arrays.CameraFOV = [];
    Arrays.CameraLocationX = [];
    Arrays.CameraLocationY = [];
    Arrays.CameraLocationZ = [];
    Arrays.CameraRotationX = [];
    Arrays.CameraRotationY = [];
    Arrays.CameraRotationZ = [];
    
    //Ball arrays
    Arrays.BallLocationX = [];
    Arrays.BallLocationY = [];
    Arrays.BallLocationZ = [];
    Arrays.BallRotationX = [];
    Arrays.BallRotationY = [];
    Arrays.BallRotationZ = [];

    //Loop through all keyframes and add their data to Arrays
    for(var i = 0; i < Keyframes.length;)
    {
        //Time
        Arrays.Time.push(Keyframes[i].Time.Time);
        
        //Camera
        Arrays.CameraFOV.push(Keyframes[i].Camera.FOV);
        Arrays.CameraLocationX.push(Keyframes[i].Camera.Location.X);
        Arrays.CameraLocationY.push(Keyframes[i].Camera.Location.Y);
        Arrays.CameraLocationZ.push(Keyframes[i].Camera.Location.Z);
        Arrays.CameraRotationX.push(Keyframes[i].Camera.Rotation.X);
        Arrays.CameraRotationY.push(Keyframes[i].Camera.Rotation.Y);
        Arrays.CameraRotationZ.push(Keyframes[i].Camera.Rotation.Z);
        
        //Ball
        Arrays.BallLocationX.push(Keyframes[i].Ball.Location.X);
        Arrays.BallLocationY.push(Keyframes[i].Ball.Location.Y);
        Arrays.BallLocationZ.push(Keyframes[i].Ball.Location.Z);
        Arrays.BallRotationX.push(Keyframes[i].Ball.Rotation.X);
        Arrays.BallRotationY.push(Keyframes[i].Ball.Rotation.Y);
        Arrays.BallRotationZ.push(Keyframes[i].Ball.Rotation.Z);
        
        ++i;
        ProgressDialog.IncrementSub();
        ProgressDialog.SubMessage(i + "/" + Keyframes.length);
    }
    
    ProgressDialog.IncrementMain();
    return Arrays;
}

function ApplyKeyframes(Arrays, HeaderData)
{
    ProgressDialog.MainMessage("Applying keyframes");
    ProgressDialog.SetSubMaxValue(2);
    
    //Start an undo group so that all composition changes can be undone easily
    app.beginUndoGroup("CinematicsBuddyAE Import");
    
    //Create reference grids, camera, and other necessary objects
    ProgressDialog.SubMessage("Creating objects");
    var MyComp = app.project.activeItem;
    var Objects = CreateCompObjects(MyComp, HeaderData);
    var CameraLayer = Objects.CameraLayer;
    var BallLayer = Objects.BallLayer;
    ProgressDialog.IncrementSub();
    
    //Apply the arrays
    ProgressDialog.SubMessage("Applying arrays");
    CameraLayer.property("Camera Options").property("Zoom").setValuesAtTimes(  Arrays.Time, Arrays.CameraFOV        );
    CameraLayer.property("Transform").property("X Position").setValuesAtTimes( Arrays.Time, Arrays.CameraLocationX  );
    CameraLayer.property("Transform").property("Y Position").setValuesAtTimes( Arrays.Time, Arrays.CameraLocationY  );
    CameraLayer.property("Transform").property("Z Position").setValuesAtTimes( Arrays.Time, Arrays.CameraLocationZ  );
    CameraLayer.property("Transform").property("X Rotation").setValuesAtTimes( Arrays.Time, Arrays.CameraRotationX  );
    CameraLayer.property("Transform").property("Y Rotation").setValuesAtTimes( Arrays.Time, Arrays.CameraRotationY  );
    CameraLayer.property("Transform").property("Z Rotation").setValuesAtTimes( Arrays.Time, Arrays.CameraRotationZ  );
    BallLayer.property("Transform").property("X Position").setValuesAtTimes(   Arrays.Time, Arrays.BallLocationX    );
    BallLayer.property("Transform").property("Y Position").setValuesAtTimes(   Arrays.Time, Arrays.BallLocationY    );
    BallLayer.property("Transform").property("Z Position").setValuesAtTimes(   Arrays.Time, Arrays.BallLocationZ    );
    BallLayer.property("Transform").property("X Rotation").setValuesAtTimes(   Arrays.Time, Arrays.BallRotationX    );
    BallLayer.property("Transform").property("Y Rotation").setValuesAtTimes(   Arrays.Time, Arrays.BallRotationY    );
    BallLayer.property("Transform").property("Z Rotation").setValuesAtTimes(   Arrays.Time, Arrays.BallRotationZ    );
    ProgressDialog.IncrementSub();
    
    //End undo group
    app.endUndoGroup();
    ProgressDialog.IncrementMain();
}
//



// UTILITY FUNCTIONS //
function RemoveWhitespace(InString)
{
    return InString.replace(/^\s+|\s+$/g,'');
}

function GetSplitHeaderLine(ThisLine)
{
    var SplitLine = ThisLine.split(":");
    
    var Output = new Object();
    Output.Label = SplitLine[0];
    Output.Data = RemoveWhitespace(SplitLine.slice(1, SplitLine.length).join());
    
    return Output;
}

function GetSplitKeyframeLine(ThisLine)
{
    var SplitLine = ThisLine.split(":");
    
    var Output = new Object();
    Output.Label = SplitLine[0];
    Output.Data = SplitLine.slice(1, SplitLine.length).join();
    
    return Output;
}

function ParseVector(VectorString)
{    
    var VectorVals = VectorString.split(",");
    
    var Vector = new Object();
    Vector.X = parseFloat(VectorVals[1]) *  2.54;
    Vector.Y = parseFloat(VectorVals[2]) * -2.54;
    Vector.Z = parseFloat(VectorVals[0]) *  2.54;
    
    return Vector;
}

function ParseQuat(QuatString)
{
    //Converts quaternion WXYZ into Euler rotation XYZ
    //https://www.euclideanspace.com/maths/geometry/rotations/conversions/quaternionToEuler/
    var QuatVals = QuatString.split(",");
    var qW = parseFloat(QuatVals[0]);
    var qX = parseFloat(QuatVals[1]);
    var qY = parseFloat(QuatVals[2]);
    var qZ = parseFloat(QuatVals[3]);
    
    //Pitch
    var H1 = (2 * qY * qW) - (2 * qX * qZ);
    var H2 = 1 - (2 * qY * qY) - (2 * qZ * qZ);
    var Pitch = Math.atan2(H1, H2);
    
    //Yaw
    var A1 = 2 * qX * qY;
    var A2 = 2 * qZ * qW;
    var Yaw = Math.asin(A1 + A2);
    
    //Roll
    var B1 = (2 * qX * qW) - (2 * qY * qZ);
    var B2 = 1 - (2 * qX * qX) - (2 * qZ * qZ);
    var Roll = Math.atan2(B1, B2);
    
    //Convert from radians to degrees
    var RadToDeg = 180 / Math.PI;
    var NewPitch = Pitch * RadToDeg;
    var NewYaw   = Yaw   * RadToDeg;
    var NewRoll  = Roll  * RadToDeg;
    
    //Output the rotation
    var Rotation = new Object();
    Rotation.X = NewPitch * -1;
    Rotation.Y = NewYaw;
    Rotation.Z = NewRoll * -1;
    
    return Rotation;
}
//

// HEADER PARSING //
function GetRecordingMetadata(HeaderData)
{
    var RecordingMetadata = new Object();
    RecordingMetadata.Version    = "";
    RecordingMetadata.Camera     = "";
    RecordingMetadata.AverageFPS = -1.0;
    RecordingMetadata.Frames     = -1;
    RecordingMetadata.Duration   = -1.0;
    
    //Skip the first line "RECORDING METADATA"
    ++HeaderData.CurrentLine;

    //Loop through all the metadata lines until an empty line is found
    while(HeaderData.CurrentLine < HeaderData.Lines.length)
    {
        var ThisLine = HeaderData.Lines[HeaderData.CurrentLine];
        ++HeaderData.CurrentLine;
        
        if(ThisLine === "")
        {
            break;
        }
        
        //Get the individual data points
        var SplitLine = GetSplitHeaderLine(ThisLine);
        if(SplitLine.Label.indexOf("Version") > -1)          { RecordingMetadata.Version    = SplitLine.Data;             }
        else if(SplitLine.Label.indexOf("Camera") > -1)      { RecordingMetadata.Camera     = SplitLine.Data;             }
        else if(SplitLine.Label.indexOf("Average FPS") > -1) { RecordingMetadata.AverageFPS = parseFloat(SplitLine.Data); }
        else if(SplitLine.Label.indexOf("Frames") > -1)      { RecordingMetadata.Frames     = parseInt(SplitLine.Data);   }
        else if(SplitLine.Label.indexOf("Duration") > -1)    { RecordingMetadata.Duration   = parseFloat(SplitLine.Data); }
    }

    return RecordingMetadata;
}

function GetReplayMetadata(HeaderData)
{
    var ReplayMetadata = new Object();
    ReplayMetadata.Name    = "";
    ReplayMetadata.ID      = "";
    ReplayMetadata.TheDate = "";
    ReplayMetadata.FPS     = -1;
    ReplayMetadata.Frames  = -1;
    
    //Skip the first line "REPLAY METADATA"
    ++HeaderData.CurrentLine;
    
    //Loop through all the metadata lines until an empty line is found
    while(HeaderData.CurrentLine < HeaderData.Lines.length)
    {
        var ThisLine = HeaderData.Lines[HeaderData.CurrentLine];
        ++HeaderData.CurrentLine;
        
        if(ThisLine === "")
        {
            break;
        }
        
        //Get the individual data points
        var SplitLine = GetSplitHeaderLine(ThisLine);
        if(SplitLine.Label.indexOf("Name") > -1)        { ReplayMetadata.Name    = SplitLine.Data;           }
        else if(SplitLine.Label.indexOf("ID") > -1)     { ReplayMetadata.ID      = SplitLine.Data;           }
        else if(SplitLine.Label.indexOf("Date") > -1)   { ReplayMetadata.TheDate = SplitLine.Data;           }
        else if(SplitLine.Label.indexOf("FPS") > -1)    { ReplayMetadata.FPS     = parseInt(SplitLine.Data); }
        else if(SplitLine.Label.indexOf("Frames") > -1) { ReplayMetadata.Frames  = parseInt(SplitLine.Data); }
    }

    return ReplayMetadata;
}

function GetCarsSeen(HeaderData)
{
    var CarsSeen = [];
    var CurrentCar = new Object();
    
    //Skip the first line "CARS SEEN"
    ++HeaderData.CurrentLine;
    
    //Loop through all the cars seen lines until an empty line is found
    while(HeaderData.CurrentLine < HeaderData.Lines.length)
    {
        var ThisLine = HeaderData.Lines[HeaderData.CurrentLine];
        ++HeaderData.CurrentLine;
        
        if(ThisLine === "")
        {
            break;
        }
    
        /*
            
            TODO: Parse cars seen in case cars are ever added to this parser
            
        */
    }

    return CarsSeen;
}

//

// KEYFRAME PARSING //
function GetKeyframeData(KeyframeString)
{
    var Keyframe = new Object();
    Keyframe.FrameNumber = -1;
    Keyframe.Ball = new Object();
    Keyframe.Camera = new Object();
    Keyframe.Cars = [];
    Keyframe.Time = new Object();
    Keyframe.CurrentLine = 0;
    
    //Split keyframe into an array of its individual lines
    var Lines = KeyframeString.split("\n");
    var StackLevel = 0;
    
    //Loop through lines
    while(Keyframe.CurrentLine < Lines.length)
    {
        //Trim the whitespace off the front and check if the keyframe is done
        var ThisLine = RemoveWhitespace(Lines[Keyframe.CurrentLine]);
        ++Keyframe.CurrentLine;
        if(ThisLine == "}")
        {
            break;
        }
        
        //Split the line by :
        var SplitLine = GetSplitKeyframeLine(ThisLine);
        
        //Choose the right data gathering function based on the group label
        if(SplitLine.Data == "{")
        {
            switch(StackLevel)
            {
                case 0:
                {
                    Keyframe.FrameNumber = parseInt(SplitLine.Label);
                    ++StackLevel;
                    break;
                }
                case 1:
                {
                    if(SplitLine.Label == "B")       { Keyframe.Ball = GetBallData(Keyframe, Lines);     }
                    else if(SplitLine.Label == "CM") { Keyframe.Camera = GetCameraData(Keyframe, Lines); }
                    else if(SplitLine.Label == "CR") { Keyframe.Cars = GetCarsData(Keyframe, Lines);     }
                    else if(SplitLine.Label == "T")  { Keyframe.Time = GetTimeData(Keyframe, Lines);     }
                    break;
                }
            }
        }
    }
    
    return Keyframe;
}

function GetBallData(Keyframe, Lines)
{
    var BallData = new Object();
    BallData.Location = new Object();
    BallData.Rotation = new Object();
    
    while(true)
    {
        //Trim the whitespace off the front and check if the group is done
        var ThisLine = RemoveWhitespace(Lines[Keyframe.CurrentLine]);
        ++Keyframe.CurrentLine;
        if(ThisLine == "}")
        {
            break;
        }
        
        //Split the line by :
        var SplitLine = GetSplitKeyframeLine(ThisLine);
        
        //Get location and rotation
        if(SplitLine.Label == "L")      { BallData.Location = ParseVector(SplitLine.Data); }
        else if(SplitLine.Label == "R") { BallData.Rotation = ParseQuat(SplitLine.Data);   }
    }
    
    return BallData;
}

function GetCameraData(Keyframe, Lines)
{
    var CameraData = new Object();
    CameraData.Location = new Object();
    CameraData.Rotation = new Object();
    CameraData.FOV = 0;
    
    while(true)
    {
        //Trim the whitespace off the front and check if the group is done
        var ThisLine = RemoveWhitespace(Lines[Keyframe.CurrentLine]);
        ++Keyframe.CurrentLine;
        if(ThisLine == "}")
        {
            break;
        }
        
        //Split the line by :
        var SplitLine = GetSplitKeyframeLine(ThisLine);
        
        //Get location, rotation, and FOV
        if(SplitLine.Label == "L")      { CameraData.Location = ParseVector(SplitLine.Data); }
        else if(SplitLine.Label == "R") { CameraData.Rotation = ParseQuat(SplitLine.Data);   }
        else if(SplitLine.Label == "F") { CameraData.FOV = GetZoom(SplitLine.Data);       }
    }
    
    return CameraData;
}

function GetZoom(InFOV)
{
    var TheComp = app.project.activeItem;
    var AspectRatio = TheComp.width / TheComp.height;
    var FOV = parseFloat(InFOV);
    var FOVRads = (FOV / 2) * (Math.PI / 180);
    var Zoom = TheComp.width / (2 * Math.tan(FOVRads));
    
    return Zoom;
}

function GetTimeData(Keyframe, Lines)
{
    var TimeData = new Object();
    TimeData.ReplayFrame = 0;
    TimeData.Time = 0.0;
    
    while(true)
    {
        //Trim the whitespace off the front and check if the group is done
        var ThisLine = RemoveWhitespace(Lines[Keyframe.CurrentLine]);
        ++Keyframe.CurrentLine;
        if(ThisLine == "}")
        {
            break;
        }
        
        //Split the line by :
        var SplitLine = GetSplitKeyframeLine(ThisLine);
        
        //Get replay frame and time
        if(SplitLine.Label == "RF")     { TimeData.ReplayFrame = parseInt(SplitLine.Data); }
        else if(SplitLine.Label == "T") { TimeData.Time = parseFloat(SplitLine.Data);      }
    }
    
    return TimeData;
}

function GetCarsData(Keyframe, Lines)
{
    var Cars = [];
    
    while(true)
    {
        //Trim the whitespace off the front and check if the group is done
        var ThisLine = RemoveWhitespace(Lines[Keyframe.CurrentLine]);
        ++Keyframe.CurrentLine;
        if(ThisLine == "}")
        {
            break;
        }
        
        //Split the line by :
        var SplitLine = GetSplitKeyframeLine(ThisLine);
        
        //Iterate through each of the cars
        var CarSeenIndex = SplitLine.Label;
        var Car = GetCarData(Keyframe, Lines);
        Car.CarSeenIndex = CarSeenIndex;
        Cars.push(Car);
    }

    return Cars;
}

function GetCarData(Keyframe, Lines)
{
    var Car = new Object();
    Car.CarSeenIndex = -1;
    Car.bBoosting = false;
    Car.Location = new Object();
    Car.Rotation = new Object();
    Car.Wheels = [];
    
    //Skip the car index since that was retrieved in the parent function
    ++Keyframe.CurrentLine;
    
    while(true)
    {
        //Trim the whitespace off the front and check if the group is done
        var ThisLine = RemoveWhitespace(Lines[Keyframe.CurrentLine]);
        ++Keyframe.CurrentLine;
        if(ThisLine == "}")
        {
            break;
        }
        
        //Split the line by :
        var SplitLine = GetSplitKeyframeLine(ThisLine);
        
        //Get all car data
        if(SplitLine.Label == "B")      { Car.bBoosting = parseInt(SplitLine.Data);     }
        else if(SplitLine.Label == "L") { Car.Location = ParseVector(SplitLine.Data);   }
        else if(SplitLine.Label == "R") { Car.Rotation = ParseQuat(SplitLine.Data);     }
        else if(SplitLine.Label == "W") { Car.Wheels = GetWheelsData(Keyframe, Lines);  }
    }
    
    return Car;
}

function GetWheelsData(Keyframe, Lines)
{
    var Wheels = [];
    
    while(true)
    {
        //Trim the whitespace off the front and check if the group is done
        var ThisLine = RemoveWhitespace(Lines[Keyframe.CurrentLine]);
        ++Keyframe.CurrentLine;
        if(ThisLine == "]")
        {
            break;
        }
        
        Wheels.push(GetWheelData(ThisLine));
    }
        
    return Wheels;    
}

function GetWheelData(ThisLine)
{
    var Wheel = new Object();
    
    //Split the line by :
    var SplitLine = GetSplitKeyframeLine(ThisLine);
    
    //Split the line by "," and get data
    var Data = SplitLine.Data.split(",");
    Wheel.SteerAmount        = parseFloat(Data[0]);
    Wheel.SuspensionDistance = parseFloat(Data[1]);
    Wheel.SpinSpeed          = parseFloat(Data[2]);
    
    return Wheel;
}
//


// COMPOSITION OBJECT CREATION //
function CreateCompObjects(MyComp, HeaderData)
{
    //Objects are added to layers in reverse order of what's seen here
    //Camera should be created last so it will be on top
    var Objects = new Object();
    
    //Grids to approximate field
    CreateGrids(MyComp, Objects);
    
    //Labels in goals
    Objects.BlueGoalLabel = CreateBlueGoalLabel(MyComp);
    Objects.OrangeGoalLabel = CreateOrangeGoalLabel(MyComp);
    
    //Car null objects
    Objects.CarLayers = CreateCars(MyComp, HeaderData);
    
    //Ball null object
    Objects.BallLayer = CreateBall(MyComp);
    
    //Camera
    Objects.CameraLayer = CreateCamera(MyComp, HeaderData);
    
    return Objects;
}

function CreateGrids(MyComp, Objects)
{
    //Floor
    var FloorLayer = CreateGrid(MyComp, "Floor");
    FloorLayer.property("Position").setValue([0, 0, 0]);
    FloorLayer.property("Scale").setValue([1024 * 2.54, 819.2 * 2.54, 100]);
    FloorLayer.property("X Rotation").setValue(-90);
    
    //Ceiling
    var CeilingLayer = CreateGrid(MyComp, "Ceiling");
    CeilingLayer.property("Position").setValue([0, 2044 * -2.54, 0]);
    CeilingLayer.property("Scale").setValue([1024 * 2.54, 819.2 * 2.54, 100]);
    CeilingLayer.property("X Rotation").setValue(-90);
    
    //Positive X Wall
    var LeftWallLayer = CreateGrid(MyComp, "Left Wall");
    LeftWallLayer.property("Position").setValue([0, 2044 * -2.54 / 2, 4096 * 2.54]);
    LeftWallLayer.property("Scale").setValue([1024 * 2.54, 204.4 * 2.54, 100]);
    LeftWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    
    //Negative X Wall
    var RightWallLayer = CreateGrid(MyComp, "Right Wall");
    RightWallLayer.property("Position").setValue([0, 2044 * -2.54 / 2, 4096 * -2.54]);
    RightWallLayer.property("Scale").setValue([1024 * 2.54, 204.4 * 2.54, 100]);
    RightWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    
    //Blue goal wall
    var BlueWallLayer = CreateGrid(MyComp, "Blue Wall");
    BlueWallLayer.property("Position").setValue([-5120 * 2.54, 2044 * -2.54 / 2, 0]);
    BlueWallLayer.property("Scale").setValue([819.2 * 2.54, 204.4 * 2.54, 100]);
    BlueWallLayer.property("Y Rotation").setValue(90);
    BlueWallLayer.property("Effects").property("ADBE Grid").property("Width").setValue(22);
    BlueWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    BlueWallLayer.property("Effects").property("ADBE Ramp").property("End Color").setValue(BlueColor);
    
    //Orange goal wall
    var OrangeWallLayer = CreateGrid(MyComp, "Orange Wall");
    OrangeWallLayer.property("Position").setValue([5120 * 2.54, 2044 * -2.54 / 2, 0]);
    OrangeWallLayer.property("Scale").setValue([819.2 * 2.54, 204.4 * 2.54, 100]);
    OrangeWallLayer.property("Y Rotation").setValue(90);
    OrangeWallLayer.property("Effects").property("ADBE Grid").property("Width").setValue(22);
    OrangeWallLayer.property("Effects").property("ADBE Grid").property("Height").setValue(80);
    OrangeWallLayer.property("Effects").property("ADBE Ramp").property("Start Color").setValue(OrangeColor);
    
    //Add all grids to objects collection
    Objects.FloorLayer = FloorLayer;
    Objects.CeilingLayer = CeilingLayer;
    Objects.LeftWallLayer = LeftWallLayer;
    Objects.RightWallLayer = RightWallLayer;
    Objects.BlueWallLayer = BlueWallLayer;
    Objects.OrangeWallLayer = OrangeWallLayer;
}

function CreateGrid(MyComp, GridName)
{
    var NewGrid = MyComp.layers.addSolid([1,1,1], GridName, 1000, 1000, 1);
    NewGrid.guideLayer = true;
    NewGrid.threeDLayer = true;
    
    //Gradient ramp effect
    var GradientEffect = NewGrid.property("Effects").addProperty("ADBE Ramp");
    GradientEffect.property("Start of Ramp").setValue([0, 500]);
    GradientEffect.property("End of Ramp").setValue([1000, 500]);
    GradientEffect.property("Start Color").setValue(BlueColor);
    GradientEffect.property("End Color").setValue(OrangeColor);
    
    //Grid effect
    var GridEffect = NewGrid.property("Effects").addProperty("ADBE Grid");
    GridEffect.property("Size From").setValue(3);
    GridEffect.property("Width").setValue(16);
    GridEffect.property("Height").setValue(20);
    GridEffect.property("Border").setValue(2);
    GridEffect.property("Blending Mode").setValue(3);
    
    return NewGrid;
}

function CreateCamera(MyComp, HeaderData)
{
    var CameraName = "UNNAMED CAMERA";
    if(HeaderData.RecordingMetadata.Camera != "")
    {
        CameraName = HeaderData.RecordingMetadata.Camera;
    }
    
    var CameraLayer = MyComp.layers.addCamera(CameraName, [MyComp.width / 2, MyComp.height / 2]);
    CameraLayer.autoOrient = AutoOrientType.NO_AUTO_ORIENT;
    CameraLayer.property("Position").dimensionsSeparated = true;
    
    return CameraLayer;
}

function CreateBall(MyComp)
{
    var BallLayer = MyComp.layers.addNull();
    BallLayer.source.name = "Ball Null Object";
    BallLayer.threeDLayer = true;
    BallLayer.property("Position").dimensionsSeparated = true;
    
    return BallLayer;
}

function CreateCar(MyComp, CarData)
{
    var ThisCar = MyComp.layers.addNull();
    ThisCar.source.name = CarData.CarName;
    ThisCar.threeDLayer = true;
    ThisCar.property("Position").dimensionsSeparated = true;
    
    return ThisCar;
}

function CreateCars(MyComp, HeaderData)
{
    var CarLayers = [];
    
    for(CarSeen in HeaderData.CarsSeen)
    {
        CarLayers.push(CreateCar(MyComp, CarSeen));
    }

    return CarLayers;
}

function CreateBlueGoalLabel(MyComp)
{
    var BlueGoalLabel = MyComp.layers.addText("Blue Goal");
    BlueGoalLabel.guideLayer = true;
    BlueGoalLabel.threeDLayer = true;
    BlueGoalLabel.property("Position").setValue([-5120 * 2.54, -600, 0]);
    BlueGoalLabel.property("Y Rotation").setValue(-90);
    var TextDocument = BlueGoalLabel.property("Source Text").value;
    TextDocument.font = "Arial-BoldMT";
    TextDocument.fontSize = 1000;
    TextDocument.fillColor = BlueColor;
    TextDocument.strokeColor = [0, 0, 0];
    TextDocument.strokeWidth = 50;
    BlueGoalLabel.property("Source Text").setValue(TextDocument);
    
    return BlueGoalLabel;
}

function CreateOrangeGoalLabel(MyComp)
{
    var OrangeGoalLabel = MyComp.layers.addText("Orange Goal");
    OrangeGoalLabel.guideLayer = true;
    OrangeGoalLabel.threeDLayer = true;
    OrangeGoalLabel.property("Position").setValue([5120 * 2.54, -600, 0]);
    OrangeGoalLabel.property("Y Rotation").setValue(90);
    var TextDocument = OrangeGoalLabel.property("Source Text").value;
    TextDocument.font = "Arial-BoldMT";
    TextDocument.fontSize = 750;
    TextDocument.fillColor = OrangeColor;
    TextDocument.strokeColor = [0, 0, 0];
    TextDocument.strokeWidth = 50;
    OrangeGoalLabel.property("Source Text").setValue(TextDocument);
    
    return OrangeGoalLabel;
}

function RemoveCompObjects(Objects)
{
    Objects.CameraLayer.remove();
    Objects.BallLayer.remove();
    Objects.FloorLayer.remove();
    Objects.CeilingLayer.remove();
    Objects.LeftWallLayer.remove();
    Objects.RightWallLayer.remove();
    Objects.BlueWallLayer.remove();
    Objects.OrangeWallLayer.remove();
    Objects.BlueGoalLabel.remove();
    Objects.OrangeGoalLabel.remove();
    
    for(CarLayer in Objects.CarLayers)
    {
        CarLayer.remove();
    }
}
//
